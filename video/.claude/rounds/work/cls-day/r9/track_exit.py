import numpy as np
from PIL import Image
import os
D=os.path.dirname(os.path.abspath(__file__));PR=f"{D}/panref"
def rgb(f): return np.asarray(Image.open(f"{PR}/f{f}.png").convert("RGB"),dtype=np.float64)
def red_cols(f,y0,y1,frac=0.5):
    im=rgb(f)[y0:y1,:];R,G,B=im[:,:,0],im[:,:,1],im[:,:,2]
    red=(R>140)&(G<130)&(B<100);cc=red.sum(axis=0)
    xs=[];x=0;n=len(cc)
    while x<n:
        if cc[x]>=(y1-y0)*frac:
            j=x
            while j<n and cc[j]>=(y1-y0)*0.2:j+=1
            xs.append((x+j-1)//2);x=j
        else:x+=1
    return xs
# band red milestone ticks only (y 100..130, above diagram). 07:00 = tick nearest expected
print("f: band red ticks (y100..135)  -> band 07:00 estimate")
for f in range(3378,3393):
    xs=red_cols(f,100,135,0.5)
    print(f, xs)
