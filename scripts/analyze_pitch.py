import json
import os
import sys
import numpy as np
from scipy.io import wavfile

def compute_f0_frame(frame, sr, min_freq=65.0, max_freq=450.0):
    frame = frame - np.mean(frame)
    energy = np.sqrt(np.mean(frame ** 2))
    # Threshold on peak-normalized signal
    if energy < 0.03:
        return None, 0.0

    min_lag = int(sr / max_freq)
    max_lag = int(sr / min_freq)

    n = len(frame)
    fft_size = 1 << (2 * n - 1).bit_length()
    f = np.fft.rfft(frame, n=fft_size)
    r = np.fft.irfft(f * np.conj(f), n=fft_size)[:n]

    if r[0] <= 1e-9:
        return None, 0.0
    r_norm = r / r[0]

    if max_lag >= n:
        max_lag = n - 1
    if min_lag >= max_lag:
        return None, 0.0

    search_region = r_norm[min_lag:max_lag]
    best_lag_rel = np.argmax(search_region)
    best_lag = min_lag + best_lag_rel
    corr_score = search_region[best_lag_rel]

    # Parabolic interpolation
    if 0 < best_lag_rel < len(search_region) - 1:
        y0 = search_region[best_lag_rel - 1]
        y1 = search_region[best_lag_rel]
        y2 = search_region[best_lag_rel + 1]
        denom = 2 * (2 * y1 - y0 - y2)
        if denom > 1e-9:
            best_lag += (y2 - y0) / denom

    f0 = sr / best_lag
    return f0, corr_score

def analyze_wav(path):
    try:
        sr, data = wavfile.read(path)
    except Exception as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        return None

    if data.ndim > 1:
        data = data[:, 0]
    data = data.astype(np.float32)
    max_val = np.max(np.abs(data))
    if max_val > 0:
        data = data / max_val
    else:
        return {"f0_median": 0, "voiced_frames": 0, "gender": "女声"}

    frame_len = int(sr * 0.040)  # 40ms frame
    hop_len = int(sr * 0.010)    # 10ms hop
    f0_list = []

    for i in range(0, len(data) - frame_len, hop_len):
        frame = data[i:i + frame_len]
        f0, corr = compute_f0_frame(frame, sr)
        if f0 is not None and corr > 0.40 and 65 <= f0 <= 450:
            f0_list.append(f0)

    if len(f0_list) < 5:
        # Fallback with lower threshold
        f0_list = []
        for i in range(0, len(data) - frame_len, hop_len):
            frame = data[i:i + frame_len]
            f0, corr = compute_f0_frame(frame, sr)
            if f0 is not None and corr > 0.25 and 65 <= f0 <= 450:
                f0_list.append(f0)

    if not f0_list:
        return {"f0_median": 0, "voiced_frames": 0, "gender": "女声"}

    f0_arr = np.array(f0_list)
    median_f0 = float(np.median(f0_arr))
    q25 = float(np.percentile(f0_arr, 25))
    q75 = float(np.percentile(f0_arr, 75))

    # Threshold: ~165 Hz
    gender = "男声" if median_f0 < 165.0 else "女声"

    return {
        "f0_median": round(median_f0, 1),
        "f0_q25": round(q25, 1),
        "f0_q75": round(q75, 1),
        "voiced_frames": len(f0_list),
        "gender": gender
    }

def main():
    wav_dir = sys.argv[1] if len(sys.argv) > 1 else "./temp_wavs"
    keys_file = sys.argv[2] if len(sys.argv) > 2 else "./scripts/calibration_keys.json"

    with open(keys_file, "r", encoding="utf-8") as f:
        items = json.load(f)

    results = []
    male_count = 0
    female_count = 0

    for item in items:
        spk_id = item["id"]
        key = item["key"]
        wav_path = os.path.join(wav_dir, f"{key}.wav")
        res = analyze_wav(wav_path)
        if not res:
            res = {"f0_median": 200.0, "gender": "女声"}

        if res["gender"] == "男声":
            male_count += 1
        else:
            female_count += 1

        results.append({
            "id": spk_id,
            "name": f"发音人 {spk_id}",
            "gender": res["gender"],
            "f0_median": res.get("f0_median", 0)
        })

    print(f"Total analyzed: {len(results)}, Males: {male_count}, Females: {female_count}")
    
    # Save voices.json
    out_voices = [{"id": r["id"], "name": r["name"], "gender": r["gender"]} for r in results]
    with open("scripts/corrected_voices.json", "w", encoding="utf-8") as f:
        json.dump(out_voices, f, ensure_ascii=False, indent=2)

    # Also save detail report
    with open("scripts/f0_analysis_report.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("Saved scripts/corrected_voices.json and scripts/f0_analysis_report.json")

if __name__ == "__main__":
    main()
