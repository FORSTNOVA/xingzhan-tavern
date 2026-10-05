import cv2,numpy as np,pathlib,json
destination=pathlib.Path('artifacts/features');destination.mkdir(parents=True,exist_ok=True)
results=[]
for codec,extension in [('avc1','mp4'),('VP80','webm'),('VP90','webm')]:
    filename=destination/('synthetic-'+codec+'.'+extension)
    writer=cv2.VideoWriter(str(filename),cv2.VideoWriter_fourcc(*codec),10,(160,90))
    opened=writer.isOpened()
    if opened:
        for n in range(20):
            frame=np.full((90,160,3),30,dtype=np.uint8);frame[:,:,n%3]=180;writer.write(frame)
    writer.release();results.append({'codec':codec,'opened':opened,'size':filename.stat().st_size if filename.exists() else 0})
print(json.dumps(results))
