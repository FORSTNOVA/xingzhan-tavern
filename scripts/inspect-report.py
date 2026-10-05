import json

with open('scripts/f0_analysis_report.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

data.sort(key=lambda x: x['f0_median'])

print("Lowest 10 (males):")
for d in data[:10]:
    print(f"  ID {d['id']:3d}: {d['f0_median']:5.1f} Hz -> {d['gender']}")

print("\nBorderline region (135Hz - 195Hz):")
border = [d for d in data if 135 <= d['f0_median'] <= 195]
for d in border:
    print(f"  ID {d['id']:3d}: {d['f0_median']:5.1f} Hz -> {d['gender']}")

print("\nHighest 10 (females):")
for d in data[-10:]:
    print(f"  ID {d['id']:3d}: {d['f0_median']:5.1f} Hz -> {d['gender']}")
