// "Star Treck" — Matthias Hurrle (@atzedent) fragment shader, ported to the
// WebGLPicks reel. The original is an interactive ShaderToy-style page with a
// code editor on top. Here we just run the fragment shader on a full-screen
// quad with frame-driven `time`. No interaction.

import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Verbatim from the source, minus the #version line which is injected
// when glslVersion === GLSL3.
const FRAGMENT = /* glsl */ `
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)

float rnd(vec2 p) {
  p = fract(p*vec2(12.9898,78.233));
  p += dot(p,p+34.56);
  return fract(p.x*p.y);
}

float noise(in vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
  float a = rnd(i),
        b = rnd(i+vec2(1,0)),
        c = rnd(i+vec2(0,1)),
        d = rnd(i+1.);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float fbm(vec2 p) {
  float t = 0., a = 1.;
  mat2 m = mat2(1.,-.5,.2,1.2);
  for (int i = 0; i < 5; i++) {
    t += a*noise(p);
    p *= 2.*m;
    a *= .5;
  }
  return t;
}

float clouds(vec2 p) {
  float d = 1., t = 0.;
  for (float i = 0.; i < 3.; i++) {
    float a = d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t = mix(t,d,a);
    d = a;
    p *= 2./(i+1.);
  }
  return t;
}

void main(void) {
  vec2 uv = (FC-.5*R)/MN, st = uv*vec2(2,1);
  vec3 col = vec3(0);
  float bg = clouds(vec2(st.x+T*.5, -st.y));
  uv *= 1.-.3*(sin(T*.2)*.5+.5);
  for (float i = 1.; i < 12.; i++) {
    uv += .1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
    vec2 p = uv;
    float d = length(p);
    col += .00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b = noise(i+p+bg*1.731);
    col += .002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col = mix(col, vec3(bg*.25,bg*.137,bg*.05), d);
  }
  O = vec4(col,1);
}
`;

const ShaderQuad: React.FC<{ time: number }> = ({ time }) => {
  const { size } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    [size.width, size.height],
  );

  if (matRef.current) {
    matRef.current.uniforms.time.value = time;
    matRef.current.uniforms.resolution.value.set(size.width, size.height);
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        glslVersion={THREE.GLSL3}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export const StarTreck: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  // Start a bit into the cycle so the scene opens on motion rather than black
  const time = 5 + frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <ShaderQuad time={time} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
