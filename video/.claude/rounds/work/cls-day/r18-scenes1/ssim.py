import sys, subprocess, os, re
REF="/Users/maxguillabert/Downloads/index/video/public/cls-day-original.mp4"
W=os.path.dirname(os.path.abspath(__file__))
def score(ref,att):
    o=subprocess.run(["ffmpeg","-nostdin","-loglevel","info","-i",att,"-i",ref,
        "-lavfi","ssim=stats_file=-","-f","null","-"],capture_output=True,text=True)
    m=re.search(r"All:([0-9.]+)", o.stdout+o.stderr)
    return float(m.group(1))
frames=[int(x) for x in sys.argv[3:]]
A,B=sys.argv[1],sys.argv[2]
print(f"{'f':>5} {A:>10} {B:>10}    delta")
tot=0
for f in frames:
    r=f"{W}/refs/r{f}.png"
    if not os.path.exists(r):
        subprocess.run(["ffmpeg","-loglevel","error","-i",REF,"-vf",f"select=eq(n\\,{f})","-vframes","1","-y",r],check=True)
    a=f"{W}/{A}/f{f}.png"; b=f"{W}/{B}/f{f}.png"
    if not (os.path.exists(a) and os.path.exists(b)): print(f"{f:>5}  MISSING"); continue
    sa,sb=score(r,a),score(r,b)
    tot+=sb-sa
    flag="  <-- REGRESSION" if sb<sa-1e-6 else ("  =" if abs(sb-sa)<1e-6 else "")
    print(f"{f:>5} {sa:10.6f} {sb:10.6f} {sb-sa:+9.6f}{flag}")
print(f"sum delta {tot:+.6f}")
