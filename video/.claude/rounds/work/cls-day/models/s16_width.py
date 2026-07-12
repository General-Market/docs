from PIL import Image
im = Image.open(".claude/rounds/work/cls-day/models/s16ref/ref_3100.png").convert("RGB")
px = im.load()
def iscolor(c):
    if c[0]>237 and c[1]>237 and c[2]>237: return False
    if abs(c[0]-c[1])<12 and abs(c[1]-c[2])<12 and c[0]>150: return False
    return True
# scan clean single-chip rows. H top chip y558 (navy), A top chip y612 (cream), C only chip y723
tests = [("H-top(navy)",558,1465),("A-top(cream)",612,386),("A-mid(red)",667,386),
         ("A-bot(red)",723,386),("C(red)",723,697),("F(navy)",723,1158),("E-top(cream)",612,1004)]
for name,y,cx in tests:
    # find the run containing cx
    x=cx
    while x>cx-160 and iscolor(px[x,y]): x-=1
    left=x+1
    x=cx
    while x<cx+160 and iscolor(px[x,y]): x+=1
    right=x-1
    print(f"{name} y{y}: left={left} right={right} w={right-left+1} center={(left+right)//2} (circleCx={cx})")
