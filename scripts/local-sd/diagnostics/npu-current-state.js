(async () => {
  const {mediaRequest, currentSpeechScope} = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
  const [config, npu, queue] = await Promise.all([
    mediaRequest('config/image').then(r => r.json()),
    mediaRequest('npu/status').then(r => r.json()),
    mediaRequest('image-queue/status').then(r => r.json()),
  ]);
  const scope = currentSpeechScope();
  const history = await mediaRequest('image-history?scope=' + encodeURIComponent(scope.id)).then(r => r.json());
  return {
    scopeId: scope.id,
    config: {
      source: config.source,
      selectedModel: config.selectedModel,
      steps: config.steps,
      cfgScale: config.cfgScale,
      negativePromptLength: String(config.negativePrompt || '').length,
    },
    npu: {
      supported: npu.supported,
      running: npu.running,
      ready: npu.ready,
      modelName: npu.modelName,
      models: (npu.models || []).map(x => ({name:x.name, format:x.format, bytes:x.bytes, fileCount:x.fileCount})),
      recentLogs: (npu.logs || []).slice(-12),
    },
    queue: {status:queue.activeTask?.status || queue.lastFinishedTask?.status || 'idle'},
    recentImages: (history.images || []).slice(0,15).map(x => ({id:x.id, source:x.source, model:x.model, ratio:x.ratio, resolution:x.resolution, createdAt:x.createdAt, promptLength:x.prompt?.length || 0})),
  };
})()
