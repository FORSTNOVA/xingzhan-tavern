# Local NPU Bridge

## Image-quality correction (2026-10-07)

The earlier HTTP/PNG smoke checks missed a serious non-square quality defect. Three user-generated 512×768 / 768×512 images were visually checked and were colored noise. A controlled 512×512 / 20-step raw-RGB run with the same managed model was coherent, while a 768×512 / 20-step raw-RGB run was already noise before PNG encoding. The managed helper had been launched without Local Dream's required `--patch` argument for non-square SD 1.5 UNet graphs. The bridge now validates the matching `.patch` file, restarts the helper when resolution changes, and passes that patch at startup. Device output through the normal Tavern route is coherent at both 512×768 and 768×512 with 20 steps / CFG 7. A 512×768 run at the user's former 4 steps / CFG 1.8 was also coherent but visibly soft. The normal-model preset is now 20 steps / CFG 7; the plugin displays exact local token counts and prevents over-limit submission. These observations cover AnythingV5 on OnePlus 13T; other models remain unverified visually.

## Current stage

The Android image settings now include a managed NPU source. They can import a Local Dream QNN SD 1.5 model ZIP from the system file picker, list/select imported models, start the helper only on request, show its logs/readiness, and stop it to release its memory. Model files and QNN runtime remain outside the APK. The image-generation path targets the managed helper on localhost and converts its streamed RGB output into PNG as verified by the smoke test.

The helper remains a child process rather than an in-process JNI engine. Model imports are limited to 1.5 GB expanded size, reject unsafe paths/symlinks and require the SD 1.5 QNN graph files. The currently verified device/runtime pair is SM8750 / HTP V79. The settings UI should be exercised on device before treating the import workflow as release-ready.

## Device verification

The OnePlus 13T reports SoC `SM8750`, which maps to HTP `V79`; its installed Local Dream is `2.8.1` / `arm64-v8a`. The V79 asset set consists of `libQnnSystem.so`, `libQnnHtp.so`, and the V79 host, Skel, and Stub libraries. Local Dream's model API was independently verified through ADB forwarding, but app-to-app loopback access from Tavern timed out on this device. The upstream helper is an executable launched with `ProcessBuilder`, not a JNI-loadable library; this is also how Local Dream invokes it.

The runtime staging path was installed and exercised on that phone. It copied exactly five allowlisted V79 files (27,929,588 bytes) to Tavern private storage, and JNI loaded both QNN host libraries. The build also extracts the 11,679,200-byte upstream native helper from the locally supplied APK into generated `jniLibs`; it is not loaded with `System.loadLibrary`, but launched as Local Dream does. `--version` succeeded and reported QNN SDK `v2.39.0.250925215840_163802`.

For the opt-in smoke run (`-PlocalNpuEngineProbe=true`), the AnythingV5 SD 1.5 QNN model archive was copied to the app's external-files import folder. The helper imported the model, initialized the QNN UNet and VAE graphs, bound `127.0.0.1:18081`, and returned HTTP 200 from `/health`. A streamed 512×512 / 8-step request then generated a valid RGB PNG: seed `20261007`, model-reported generation time `1411 ms`, first step `148 ms`, output size `688,978` bytes. The image is saved at `artifacts/local-npu-smoke/anythingv5-npu.png`. This first probe used temporary ADB forwarding; later plugin-route tests are described below. The helper remains a subprocess rather than an in-process JNI engine.

After wiring the plugin, the normal APK was installed and the helper was started from the authenticated Tavern route with an imported model. The route reported ready on port 18081; a request to the plugin's normal `generate-image` API returned a 512×512 PNG and stored it in image history. The managed route reported 942 ms generation time. The helper was then stopped through the management route and the prior image source/model settings were restored. This run required no cloud/API request.

The visible ZIP chooser was exercised on the OnePlus 13T. The new button opened ColorOS's system `ACTION_OPEN_DOCUMENT` picker; a search in Downloads found and selected `AnythingV5_qnn2.28_8gen2.zip` (about 0.98 GB). The plugin showed the selected filename, streamed the archive to the local service, validated and extracted the model, and refreshed the model list. Import completed as `AnythingV5-qnn2-28-8gen2` (1,300,550,059 bytes, 13 recognized model/patch files) while preserving the previously imported `anythingv5-qnn-8gen2` directory. The new model then independently initialized on HTP V79 and reached `/health`; managed start returned `ready: true`, and stop returned `running: false` with helper exit by `SIGTERM`. A follow-up generation through the normal plugin endpoint returned a 512×512 PNG (563,178 bytes) in 940 ms and saved it to image history. User image settings were restored to source `local` and model `Counterfeit-V3.0_Q4_0.gguf` after the import flow auto-selected the newly imported model.

Cancellation and lifecycle checks also passed on device. Canceling an active generation through the normal image queue returned HTTP 200 from cancel and HTTP 499 from generation, with the queue idle afterward and the helper still ready for another request. Android force-stop removed the app-owned helper process; reopening the app recovered and cleared the stale PID marker. Two consecutive start requests remained idempotent, and two stop requests left the service stopped. At idle after cancellation, the app measured about 479 MB PSS and helper about 346 MB PSS; thermal status was 0, skin about 37.1 °C, and battery about 32.2 °C. These are point-in-time idle readings, not peak measurements during inference.

The settings UI was reorganized on the OnePlus 13T. With models present, the import and generation-parameter cards begin collapsed so the model picker, start/stop controls, and current state fit near the top of the dialog. The file chooser remains available in the import card; upload percentage and the later extraction phase have separate messages. While a model runs, the picker and import controls are disabled. Starting another model directly through the API now returns HTTP 503 with a stop-first message instead of falsely reporting success, and the running model remains unchanged.

A device run switched `AnythingV5-qnn2-28-8gen2` → `anythingv5-qnn-8gen2` → `AnythingV5-qnn2-28-8gen2`, generating one 512×512 / 4-step PNG per model selection through the normal plugin endpoint. All three returned HTTP 200; model-reported times were 815, 888, and 812 ms. Across six sampled points during those runs, observed peaks were 432,951 KiB app PSS, 355,863 KiB helper PSS, 43.897 °C current HAL skin temperature, 33.3 °C battery, and thermal status 0. A separate 30-step generation succeeded in 4,848 ms; its sampled skin temperature reached 45.257 °C, so the validation script stopped additional sustained runs at its conservative 44 °C guard. This was a test guard, not Android thermal throttling. The helper was stopped, the previous local SD configuration restored, and only these validation images were removed from character image history.

Selecting an absent model returns HTTP 400 with a clear not-imported error; trying to start it returns HTTP 503 and leaves the helper stopped. Neither request changed the saved image source or model.

The default build keeps the smoke-test switch off so opening Tavern does not automatically load the 1.3 GB model. The QNN runtime is staged from the installed Local Dream app; the imported model is stored in Tavern's app-scoped external files. LOCALDREAM-ATTRIBUTION.txt and the full upstream license are bundled with the APK because the optional helper binary is reproduced from Local Dream 2.8.1; the upstream project is CC BY-NC 4.0. Qualcomm runtime and model terms are separate.

The locally installed Local Dream 2.8.1 APK contains a native inference core (`libstable_diffusion_core.so`, about 11.7 MB) and QNN libraries under `assets/qnnlibs/`, including several HTP architecture variants. The core has no exported dynamic symbols, so it cannot be called as a drop-in library; its source must be built behind Tavern's own JNI API. Tavern extracts only the V79 runtime subset at runtime; the converted model ZIP remains separate from the APK.

## Integration boundary

The integrated call path is:

`SillyTavern image UI -> authenticated media route -> managed helper process -> QNN/Hexagon -> streamed RGB -> PNG/image history`

The implementation target is SD 1.5 NPU at 512×512 and one known-good converted model. The existing SD.cpp CPU/GPU and remote image sources remain available as fallbacks.

## Before importing third-party code or binaries

- Local Dream's repository `LICENSE` is CC BY-NC 4.0. Review attribution and redistribution obligations before incorporating or distributing adapted code.
- Qualcomm QNN/QAIRT runtime binaries have separate vendor terms. Confirm the applicable redistribution permission before packaging them in Tavern.
- Model packages and their base checkpoints have separate model licenses.
- Keep an SBOM/notice file for Local Dream-derived code, native dependencies, QNN runtime files, and each downloadable model.

## Remaining verification

1. Measure longer generation sessions with controlled cooling if sustained heat behavior matters; the current result covers one 30-step run and three 4-step model-switch runs, with sampled rather than absolute peaks.
2. Verify error handling when the helper or runtime is missing and check the UI on unsupported chips; the missing-model path was verified on the 13T.
3. Evaluate a source-level JNI refactor only if the helper-process boundary proves unstable; compiling upstream source requires compatible Qualcomm QAIRT SDK headers and SampleApp files.
