import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import crypto from 'node:crypto';

// Setup isolated test environment
const root = path.resolve('artifacts/relay/google-analysis-fixture-' + Date.now());
await fs.mkdir(path.join(root, 'src/endpoints'), {recursive: true});

// Secrets mock storage
const mockSecrets = {
  api_key_makersuite: 'global-makersuite-key-12345',
  api_key_vertexai: 'global-vertex-key-67890',
  vertexai_service_account_json: ''
};

// Generate test RSA keypair for Service Account testing
const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {type: 'spki', format: 'pem'},
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
});

const testServiceAccount = {
  type: 'service_account',
  project_id: 'test-gcp-project-99',
  private_key_id: 'key-id-1',
  private_key: privateKey,
  client_email: 'test-sa@test-gcp-project-99.iam.gserviceaccount.com',
  client_id: '123456789'
};
mockSecrets.vertexai_service_account_json = JSON.stringify(testServiceAccount);

await fs.writeFile(path.join(root, 'src/endpoints/secrets.js'), `
const store = ${JSON.stringify(mockSecrets)};
export const readSecret = (_dirs, key) => store[key] || '';
export const writeSecret = (_dirs, key, val) => { store[key] = val; };
export const deleteSecret = (_dirs, key) => { delete store[key]; };
`);

await fs.copyFile('app/src/main/assets/android-media.mjs', path.join(root, 'android-media.mjs'));

const mediaModule = await import(new URL('file:///' + path.join(root, 'android-media.mjs').replaceAll('\\', '/')));
const {
  installMediaRoutes,
  resolveAnalysisAuth,
  googleAiStudioUrl,
  googleVertexUrl,
  generateVertexJwt,
  getVertexAccessToken
} = mediaModule;

const routes = new Map();
installMediaRoutes({
  use() {},
  get(route, handler) { routes.set('GET ' + route, handler); },
  post(route, handler) { routes.set('POST ' + route, handler); }
});

const req = (body = {}, params = {kind: 'analysis'}, query = {}) => ({
  user: {directories: {root}},
  params,
  query,
  body
});

function createResponse() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.writableEnded = false;
  res.headersSent = false;
  res.destroyed = false;
  res.set = (key, value) => { res.headers[key] = value; return res; };
  res.status = code => { res.statusCode = code; return res; };
  res.sendStatus = code => res.status(code).send(String(code));
  res.send = res.json = body => { res.result = body; res.writableEnded = true; return res; };
  return res;
}

const passed = [];

// 1. Test googleAiStudioUrl and googleVertexUrl
{
  const studioUrl = googleAiStudioUrl('gemini-2.5-flash');
  assert.equal(studioUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

  const vertexUrl1 = googleVertexUrl({vertexRegion: 'us-central1', vertexProjectId: 'my-proj'}, 'gemini-2.5-flash');
  assert.equal(vertexUrl1, 'https://us-central1-aiplatform.googleapis.com/v1/projects/my-proj/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent');

  const vertexUrlGlobal = googleVertexUrl({vertexRegion: 'global', vertexProjectId: 'my-proj'}, 'gemini-2.5-flash');
  assert.equal(vertexUrlGlobal, 'https://aiplatform.googleapis.com/v1/projects/my-proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent');

  passed.push('Google AI Studio 与 Vertex AI 端点 URL 拼接正确');
}

// 2. Test generateVertexJwt and getVertexAccessToken
{
  const jwt = await generateVertexJwt(testServiceAccount);
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(payload.iss, testServiceAccount.client_email);
  assert.equal(payload.aud, 'https://oauth2.googleapis.com/token');

  // Test token exchange with mock oauth2 token endpoint
  const originalFetch = globalThis.fetch;
  let tokenCallCount = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      tokenCallCount++;
      assert.equal(options.method, 'POST');
      assert.ok(String(options.body).includes('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer'));
      return new Response(JSON.stringify({access_token: 'mock-gcp-access-token-abc', expires_in: 3600}));
    }
    return originalFetch(url, options);
  };

  const token1 = await getVertexAccessToken(JSON.stringify(testServiceAccount));
  assert.equal(token1, 'mock-gcp-access-token-abc');
  assert.equal(tokenCallCount, 1);

  // Cached token check
  const token2 = await getVertexAccessToken(JSON.stringify(testServiceAccount));
  assert.equal(token2, 'mock-gcp-access-token-abc');
  assert.equal(tokenCallCount, 1, 'Token 应被缓存，不触发二次请求');

  globalThis.fetch = originalFetch;
  passed.push('Vertex AI RS256 JWT 签名与 OAuth2 Token 缓存交换正常');
}

// 3. Test configView and resolveAnalysisAuth
{
  const res = createResponse();
  await routes.get('GET /api/android/media/config/:kind')(req({}, {kind: 'analysis'}), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.result.globalAvailable.makersuite, true);
  assert.equal(res.result.globalAvailable.vertexExpress, true);
  assert.equal(res.result.globalAvailable.vertexFull, true);

  // Default is relay
  assert.equal(res.result.source, 'relay');

  // Change to makersuite with global key
  const saveRes = createResponse();
  await routes.get('POST /api/android/media/config/:kind')(req({
    source: 'makersuite',
    model: 'gemini-2.5-flash',
    useGlobalKey: true
  }, {kind: 'analysis'}), saveRes);
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.result.source, 'makersuite');
  assert.equal(saveRes.result.hasKey, true);
  assert.equal(saveRes.result.hasGlobalKey, true);

  const authStudio = resolveAnalysisAuth({user: {directories: {root}}}, saveRes.result);
  assert.equal(authStudio.source, 'makersuite');
  assert.equal(authStudio.key, 'global-makersuite-key-12345');
  assert.equal(authStudio.headers['x-goog-api-key'], 'global-makersuite-key-12345');

  // Change to vertexai full mode with global service account
  const saveVertex = createResponse();
  await routes.get('POST /api/android/media/config/:kind')(req({
    source: 'vertexai',
    vertexAuthMode: 'full',
    vertexRegion: 'us-central1',
    model: 'gemini-2.5-pro',
    useGlobalKey: true
  }, {kind: 'analysis'}), saveVertex);
  assert.equal(saveVertex.statusCode, 200);
  assert.equal(saveVertex.result.source, 'vertexai');
  assert.equal(saveVertex.result.vertexAuthMode, 'full');

  const authVertex = resolveAnalysisAuth({user: {directories: {root}}}, saveVertex.result);
  assert.equal(authVertex.source, 'vertexai');
  assert.equal(authVertex.authMode, 'full');
  assert.equal(authVertex.projectId, 'test-gcp-project-99');
  assert.ok(authVertex.saJson.includes('test-sa@test-gcp-project-99'));

  passed.push('配置读取保存、全局密钥状态反馈与凭据解析正常');
}

// 4. Test analyzeChunk with Google AI Studio generateContent format
{
  const originalFetch = globalThis.fetch;
  let studioPayload = null;
  let studioHeaders = null;
  let studioUrl = null;

  globalThis.fetch = async (url, options) => {
    studioUrl = String(url);
    studioHeaders = options.headers;
    studioPayload = JSON.parse(options.body);

    const mockResponseText = JSON.stringify({
      segments: [
        {unitIds: [0], type: 'narration', speakerId: 'narrator', typeConfidence: 0.95, speakerConfidence: 0.95, evidenceUnitIds: [0]},
        {unitIds: [1], type: 'dialogue', speakerId: 'alice', typeConfidence: 0.98, speakerConfidence: 0.99, evidenceUnitIds: [1]}
      ],
      speakers: [
        {id: 'alice', name: '爱丽丝', gender: 'female', summary: '主角少女', voiceSuggestion: 'Aoede'}
      ]
    });

    return new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{text: mockResponseText}]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 65
      }
    }));
  };

  // Switch config to makersuite
  await routes.get('POST /api/android/media/config/:kind')(req({
    source: 'makersuite',
    model: 'gemini-2.5-flash',
    useGlobalKey: true
  }, {kind: 'analysis'}), createResponse());

  const analyzeRes = createResponse();
  await routes.get('POST /api/android/media/analyze')(req({
    text: '阳光穿过树梢。“早上好！”',
    scopeId: 'google-studio-test'
  }), analyzeRes);

  assert.equal(analyzeRes.statusCode, 200);
  assert.ok(studioUrl.includes('generativelanguage.googleapis.com'));
  assert.equal(studioHeaders['x-goog-api-key'], 'global-makersuite-key-12345');
  assert.ok(studioPayload.systemInstruction, 'Gemini 原生协议必须包含 systemInstruction');
  assert.equal(studioPayload.generationConfig.responseMimeType, 'application/json');
  assert.equal(analyzeRes.result.segments.length, 2);
  assert.equal(analyzeRes.result.segments[1].speakerId, 'alice');
  assert.equal(analyzeRes.result.speakers[0].name, '爱丽丝');

  globalThis.fetch = originalFetch;
  passed.push('Google AI Studio 原生 generateContent 协议分析与结果解析成功');
}

// 5. Test analyzeChunk with Vertex AI (Full Mode Service Account)
{
  const originalFetch = globalThis.fetch;
  let vertexAuthHeader = '';
  let vertexCalledUrl = '';

  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({access_token: 'vertex-temp-bearer-xyz', expires_in: 3600}));
    }

    vertexCalledUrl = String(url);
    vertexAuthHeader = options.headers['Authorization'] || options.headers['authorization'];

    const mockResponseText = JSON.stringify({
      segments: [
        {unitIds: [0], type: 'dialogue', speakerId: 'bob', typeConfidence: 0.99, speakerConfidence: 0.99, evidenceUnitIds: [0]}
      ],
      speakers: [
        {id: 'bob', name: '鲍勃', gender: 'male', summary: '老船长', voiceSuggestion: 'Puck'}
      ]
    });

    return new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{text: mockResponseText}]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 80,
        candidatesTokenCount: 40
      }
    }));
  };

  // Switch config to vertexai full
  await routes.get('POST /api/android/media/config/:kind')(req({
    source: 'vertexai',
    vertexAuthMode: 'full',
    vertexRegion: 'us-central1',
    model: 'gemini-2.5-pro',
    useGlobalKey: true
  }, {kind: 'analysis'}), createResponse());

  const analyzeVertexRes = createResponse();
  await routes.get('POST /api/android/media/analyze')(req({
    text: '“起航吧！”',
    scopeId: 'vertex-full-test'
  }), analyzeVertexRes);

  assert.equal(analyzeVertexRes.statusCode, 200);
  assert.ok(vertexCalledUrl.includes('us-central1-aiplatform.googleapis.com'));
  assert.ok(vertexCalledUrl.includes('test-gcp-project-99'));
  assert.equal(vertexAuthHeader, 'Bearer mock-gcp-access-token-abc');
  assert.equal(analyzeVertexRes.result.segments[0].speakerId, 'bob');
  assert.equal(analyzeVertexRes.result.speakers[0].voiceSuggestion, 'Puck');

  globalThis.fetch = originalFetch;
  passed.push('Google Cloud Vertex AI (Service Account JWT 交换) 分析与结果解析成功');
}

// 6. Test diagnostics and models endpoints for Google AI Studio
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('models?key=')) {
      return new Response(JSON.stringify({
        models: [
          {name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent']},
          {name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent']},
          {name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent']}
        ]
      }));
    }
    return originalFetch(url);
  };

  // Switch to makersuite
  await routes.get('POST /api/android/media/config/:kind')(req({
    source: 'makersuite',
    model: 'gemini-2.5-flash',
    useGlobalKey: true
  }, {kind: 'analysis'}), createResponse());

  // Models list
  const modelsRes = createResponse();
  await routes.get('GET /api/android/media/models/:kind')(req({}, {kind: 'analysis'}), modelsRes);
  assert.equal(modelsRes.statusCode, 200);
  assert.ok(modelsRes.result.models.includes('gemini-2.5-flash'));
  assert.ok(modelsRes.result.models.includes('gemini-2.5-pro'));
  assert.ok(!modelsRes.result.models.includes('text-embedding-004'), '应自动过滤非 generateContent 模型');

  // Diagnostics check
  const diagRes = createResponse();
  await routes.get('GET /api/android/media/diagnostics/:kind')(req({}, {kind: 'analysis'}), diagRes);
  assert.equal(diagRes.statusCode, 200);
  assert.equal(diagRes.result.listed, true);

  globalThis.fetch = originalFetch;
  passed.push('Google AI Studio 模型列表获取与连接诊断检查通过');
}

// 7. Test imagePrompt with Google direct
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).includes('generativelanguage.googleapis.com'));
    return new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{text: JSON.stringify({prompt: '阳光下的海边灯塔，动漫风格', aspect_ratio: '16:9', title: '海边灯塔'})}]
          }
        }
      ]
    }));
  };

  const promptRes = createResponse();
  await routes.get('POST /api/android/media/image-prompt')(req({
    text: '我们在海边的灯塔下吹风。'
  }), promptRes);

  assert.equal(promptRes.statusCode, 200);
  assert.equal(promptRes.result.prompt, '阳光下的海边灯塔，动漫风格');
  assert.equal(promptRes.result.aspect_ratio, '16:9');

  globalThis.fetch = originalFetch;
  passed.push('文生图提示词在 Google AI Studio 直连下生成成功');
}

console.log(JSON.stringify({passed, success: true}, null, 2));
