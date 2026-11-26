import { CropState, EditParams } from '../types/editor';

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_image;
uniform vec2 u_texelSize;

// Tone & Exposure
uniform float u_exposure;     // EV (-3..+3)
uniform float u_highlights;   // -1..+1
uniform float u_shadows;      // -1..+1
uniform float u_contrast;     // -1..+1
uniform float u_whites;       // -1..+1
uniform float u_blacks;       // -1..+1

// Color
uniform float u_temperature;  // Kelvin (2000..10000)
uniform float u_tint;         // -1..+1
uniform float u_vibrance;     // -1..+1
uniform float u_shadowTint;   // -1..+1

// Detail & Portrait
uniform float u_clarity;      // -1..+1
uniform float u_grain;        // 0..1
uniform float u_dofBlur;      // 0..1
uniform vec2 u_dofRadii;      // rx, ry (fraction of height)
uniform float u_dofAngle;     // radians
uniform float u_dofFeather;   // fraction of height
uniform vec2 u_dofFocus;      // 0..1, 0..1
uniform float u_skinSmooth;   // 0..1
uniform float u_catchlight;   // 0..1
uniform float u_skinWarmth;   // 0..1

// View controls
uniform float u_splitX;       // 0..1 (1.0 = full edited)
uniform int u_showOriginal;   // 1 = show original
uniform int u_showClipping;   // 1 = show highlight/shadow clipping

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 srgbToLinear(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

// Convert RGB (0..1) to Hue (0..360) and Saturation (0..1)
vec2 rgbToHS(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float delta = maxC - minC;
  float sat = maxC > 0.0001 ? delta / maxC : 0.0;
  float hue = 0.0;
  if (delta > 0.0001) {
    if (maxC == c.r) {
      hue = mod((c.g - c.b) / delta, 6.0);
    } else if (maxC == c.g) {
      hue = (c.b - c.r) / delta + 2.0;
    } else {
      hue = (c.r - c.g) / delta + 4.0;
    }
    hue *= 60.0;
    if (hue < 0.0) hue += 360.0;
  }
  return vec2(hue, sat);
}

// Skin tone mask (15..45 deg primary, soft falloff 5..55 deg)
float skinMask(vec3 c) {
  vec2 hs = rgbToHS(c);
  float h = hs.x;
  float s = hs.y;
  float hueMask = smoothstep(5.0, 18.0, h) * (1.0 - smoothstep(42.0, 58.0, h));
  float satMask = smoothstep(0.08, 0.2, s) * (1.0 - smoothstep(0.65, 0.85, s));
  return hueMask * satMask;
}

// Soft-knee highlight clip guard
vec3 softClip(vec3 x) {
  vec3 threshold = vec3(0.85);
  vec3 over = max(x - threshold, vec3(0.0));
  vec3 compressed = threshold + (1.0 - threshold) * (over / (over + (1.0 - threshold)));
  return mix(x, compressed, step(threshold, x));
}

// Approximate Planckian white balance shift relative to 5500K
vec3 whiteBalanceMatrix(float kelvin, float tint) {
  float kNorm = (kelvin - 5500.0) / 4500.0; // approx -0.78 to +1.0
  float rGain = 1.0 + kNorm * 0.28;
  float bGain = 1.0 - kNorm * 0.30;
  float gGain = 1.0 - tint * 0.18;
  // Normalize luminance preservation
  vec3 gains = vec3(max(rGain, 0.4), max(gGain, 0.5), max(bGain, 0.4));
  float luma = getLuma(gains);
  return gains / max(luma, 0.001);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 origSample = texture(u_image, v_texCoord);
  vec3 orig = origSample.rgb;

  // Before / After split check
  if (u_showOriginal == 1 || v_texCoord.x > u_splitX) {
    outColor = vec4(orig, origSample.a);
    return;
  }

  // 1. Optional Depth of Field (Affinity-style Rotated Concentric Elliptical Bokeh)
  vec3 baseColor = orig;
  if (u_dofBlur > 0.001) {
    float aspect = u_texelSize.y / max(u_texelSize.x, 0.00001);
    vec2 diff = v_texCoord - u_dofFocus;
    diff.x *= aspect;
    float c = cos(-u_dofAngle);
    float s = sin(-u_dofAngle);
    vec2 rot = vec2(diff.x * c - diff.y * s, diff.x * s + diff.y * c);

    float rx = max(u_dofRadii.x, 0.02);
    float ry = max(u_dofRadii.y, 0.02);
    float f = max(u_dofFeather, 0.02);

    float dInner = length(vec2(rot.x / rx, rot.y / ry));
    float dOuter = length(vec2(rot.x / (rx + f), rot.y / (ry + f)));

    float t = 0.0;
    if (dOuter >= 1.0) {
      t = 1.0;
    } else if (dInner > 1.0) {
      t = smoothstep(0.0, 1.0, (dInner - 1.0) / max(0.0001, dInner - dOuter));
    }

    float coc = t * u_dofBlur;
    if (coc > 0.005) {
      vec3 acc = vec3(0.0);
      float wTotal = 0.0;
      float maxRadiusPx = coc * 22.0;
      const float GOLDEN_ANGLE = 2.39996323;
      for (int i = 0; i < 20; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 20.0) * maxRadiusPx;
        float theta = fi * GOLDEN_ANGLE;
        vec2 offset = vec2(cos(theta), sin(theta)) * r * u_texelSize;
        vec3 smp = texture(u_image, clamp(v_texCoord + offset, vec2(0.001), vec2(0.999))).rgb;
        // Subtle optical highlight bokeh weighting
        float w = 1.0 + smoothstep(0.75, 1.0, getLuma(smp)) * 0.65;
        acc += smp * w;
        wTotal += w;
      }
      baseColor = acc / max(wTotal, 0.0001);
    }
  }

  // 1b. Optional edge-preserving skin smoothing (sampled in sRGB before tone)
  if (u_skinSmooth > 0.001) {
    float sm = skinMask(orig);
    if (sm > 0.01) {
      vec3 sum = vec3(0.0);
      float wSum = 0.0;
      for (int dx = -2; dx <= 2; dx++) {
        for (int dy = -2; dy <= 2; dy++) {
          vec2 offset = vec2(float(dx), float(dy)) * u_texelSize * 1.6;
          vec3 s = texture(u_image, v_texCoord + offset).rgb;
          float colorDist = length(s - orig);
          // Edge-preserving bilateral weight keeps eyes, lips, hair sharp
          float weight = exp(-colorDist * 14.0) * exp(-float(dx*dx + dy*dy) * 0.18);
          sum += s * weight;
          wSum += weight;
        }
      }
      vec3 smoothed = sum / max(wSum, 0.0001);
      baseColor = mix(orig, smoothed, sm * u_skinSmooth * 0.72);
    }
  }

  // 2. Linear light domain: White Balance + Exposure
  vec3 lin = srgbToLinear(baseColor);
  vec3 wb = whiteBalanceMatrix(u_temperature, u_tint);
  lin *= wb;

  // Exposure in linear light with Highlight Clip Guard
  float expMul = pow(2.0, u_exposure);
  lin *= expMul;
  lin = softClip(lin);

  // Back to perceptual gamma domain for tone curve, highlights, shadows
  vec3 col = clamp(linearToSrgb(lin), 0.0, 1.0);
  float luma = getLuma(col);

  // 3. Highlights (top 25% luminance) & Shadows (bottom 35% luminance)
  float hiWeight = smoothstep(0.55, 0.95, luma);
  float shWeight = 1.0 - smoothstep(0.05, 0.45, luma);
  col += col * (u_highlights * 0.45 * hiWeight);
  // Shadows: lift mid-shadows while anchoring true black
  float shadowLift = u_shadows * 0.38 * shWeight * smoothstep(0.0, 0.08, luma + 0.02);
  col += vec3(shadowLift);
  col = clamp(col, 0.0, 1.0);

  // 4. Whites & Blacks offset
  float blackOffset = u_blacks * 0.14;
  float whiteScale = 1.0 + u_whites * 0.18;
  col = clamp((col + blackOffset) * whiteScale, 0.0, 1.0);

  // 5. Contrast (S-curve around 0.5)
  if (abs(u_contrast) > 0.001) {
    float cFactor = 1.0 + u_contrast * 0.65;
    vec3 sCurve = col * col * (3.0 - 2.0 * col);
    if (u_contrast > 0.0) {
      col = mix(col, sCurve, u_contrast * 0.75);
    } else {
      col = mix(col, vec3(0.5) + (col - vec3(0.5)) * cFactor, 0.85);
    }
    col = clamp(col, 0.0, 1.0);
  }

  // 6. Shadow Tint (cinematic cyan/teal or warm amber in shadows)
  if (abs(u_shadowTint) > 0.001) {
    float sMask = 1.0 - smoothstep(0.0, 0.5, getLuma(col));
    vec3 teal = vec3(0.02, 0.14, 0.16);
    vec3 amber = vec3(0.18, 0.10, 0.02);
    vec3 tintCol = u_shadowTint < 0.0 ? teal * (-u_shadowTint) : amber * u_shadowTint;
    col = clamp(col + tintCol * sMask * 0.6, 0.0, 1.0);
  }

  // 7. Clarity (mid-frequency local contrast without haloing) & Catchlight
  if (abs(u_clarity) > 0.001 || u_catchlight > 0.001) {
    vec3 blur = (
      texture(u_image, v_texCoord + vec2(-2.0, -2.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2( 2.0, -2.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2(-2.0,  2.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2( 2.0,  2.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2(-4.0,  0.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2( 4.0,  0.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2( 0.0, -4.0) * u_texelSize).rgb +
      texture(u_image, v_texCoord + vec2( 0.0,  4.0) * u_texelSize).rgb
    ) * 0.125;

    float curLuma = getLuma(col);
    float blurLuma = getLuma(blur);
    float detail = curLuma - blurLuma;
    // Anti-halo damping on extreme edges
    float haloGuard = 1.0 - smoothstep(0.12, 0.35, abs(detail));
    float midtoneWeight = 1.0 - abs(curLuma - 0.5) * 1.4;
    midtoneWeight = clamp(midtoneWeight, 0.2, 1.0);

    col += vec3(detail * u_clarity * 0.85 * haloGuard * midtoneWeight);

    // Catchlight boost on small bright specular highlights
    if (u_catchlight > 0.001) {
      float spec = smoothstep(0.68, 0.94, curLuma) * clamp(detail * 4.0, 0.0, 1.0);
      col += vec3(spec * u_catchlight * 0.38);
    }
    col = clamp(col, 0.0, 1.0);
  }

  // 8. Skin-tone Warmth & Brightness (Section 5.2)
  if (u_skinWarmth > 0.001) {
    float sm = skinMask(col);
    vec3 warmTarget = col * vec3(1.08, 1.03, 0.95) + vec3(0.04, 0.02, 0.0);
    col = mix(col, clamp(warmTarget, 0.0, 1.0), sm * u_skinWarmth * 0.65);
  }

  // 9. Vibrance with Skintone Safeguard (Section 4.2)
  if (abs(u_vibrance) > 0.001) {
    float lum = getLuma(col);
    float maxC = max(col.r, max(col.g, col.b));
    float minC = min(col.r, min(col.g, col.b));
    float sat = maxC - minC;

    // Non-linear vibrance: boosts low-sat more than already saturated colors
    float vibWeight = (1.0 - sat);
    // Skintone safeguard: attenuate saturation increase by 50% in skin-tone hues
    float sm = skinMask(col);
    float skinDamp = u_vibrance > 0.0 ? mix(1.0, 0.5, sm) : 1.0;

    float satAdjust = 1.0 + u_vibrance * 0.95 * vibWeight * skinDamp;
    col = clamp(mix(vec3(lum), col, satAdjust), 0.0, 1.0);
  }

  // 10. Film Grain
  if (u_grain > 0.001) {
    float n = hash12(v_texCoord * vec2(1920.0, 1080.0)) - 0.5;
    float lum = getLuma(col);
    float grainMask = 1.0 - abs(lum - 0.5) * 0.8;
    col = clamp(col + vec3(n * u_grain * 0.14 * grainMask), 0.0, 1.0);
  }

  // 11. Highlight / Shadow Clipping Warning Overlay
  if (u_showClipping == 1) {
    if (col.r >= 0.992 && col.g >= 0.992 && col.b >= 0.992) {
      col = mix(col, vec3(1.0, 0.15, 0.15), 0.75);
    } else if (col.r <= 0.008 && col.g <= 0.008 && col.b <= 0.008) {
      col = mix(col, vec3(0.15, 0.45, 1.0), 0.75);
    }
  }

  outColor = vec4(col, origSample.a);
}
`;

export class WebGLImageRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private texWidth = 1;
  private texHeight = 1;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) {
      throw new Error('WebGL 2.0 is not supported in this browser.');
    }
    this.gl = gl;
    this.program = this.createProgram(VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);
    this.setupQuad();
    this.cacheUniforms();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private setupQuad(): void {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const positions = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    this.vao = vao;
  }

  private cacheUniforms(): void {
    const names = [
      'u_image', 'u_texelSize',
      'u_exposure', 'u_highlights', 'u_shadows', 'u_contrast', 'u_whites', 'u_blacks',
      'u_temperature', 'u_tint', 'u_vibrance', 'u_shadowTint',
      'u_clarity', 'u_grain', 'u_dofBlur', 'u_dofRadii', 'u_dofAngle', 'u_dofFeather', 'u_dofFocus',
      'u_skinSmooth', 'u_catchlight', 'u_skinWarmth',
      'u_splitX', 'u_showOriginal', 'u_showClipping',
    ];
    for (const name of names) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    }
  }

  public uploadImage(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }
    this.texWidth = width;
    this.texHeight = height;

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.texture = tex;
  }

  public render(
    params: EditParams,
    options: { splitX?: number; showOriginal?: boolean; showClipping?: boolean } = {}
  ): void {
    if (!this.texture) return;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas.width !== this.texWidth || canvas.height !== this.texHeight) {
      canvas.width = this.texWidth;
      canvas.height = this.texHeight;
    }

    gl.viewport(0, 0, this.texWidth, this.texHeight);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.u_image, 0);
    gl.uniform2f(this.uniforms.u_texelSize, 1.0 / this.texWidth, 1.0 / this.texHeight);

    gl.uniform1f(this.uniforms.u_exposure, params.exposure);
    gl.uniform1f(this.uniforms.u_highlights, params.highlights / 100);
    gl.uniform1f(this.uniforms.u_shadows, params.shadows / 100);
    gl.uniform1f(this.uniforms.u_contrast, params.contrast / 100);
    gl.uniform1f(this.uniforms.u_whites, params.whites / 100);
    gl.uniform1f(this.uniforms.u_blacks, params.blacks / 100);

    gl.uniform1f(this.uniforms.u_temperature, params.temperature);
    gl.uniform1f(this.uniforms.u_tint, params.tint / 100);
    gl.uniform1f(this.uniforms.u_vibrance, params.vibrance / 100);
    gl.uniform1f(this.uniforms.u_shadowTint, params.shadowTint / 100);

    gl.uniform1f(this.uniforms.u_clarity, params.clarity / 100);
    gl.uniform1f(this.uniforms.u_grain, params.grain / 100);
    gl.uniform1f(this.uniforms.u_dofBlur, params.dofBlur / 100);
    gl.uniform2f(this.uniforms.u_dofRadii, params.dofRadiusX / 100, params.dofRadiusY / 100);
    gl.uniform1f(this.uniforms.u_dofAngle, (params.dofAngle * Math.PI) / 180);
    gl.uniform1f(this.uniforms.u_dofFeather, params.dofFeather / 100);
    gl.uniform2f(this.uniforms.u_dofFocus, params.dofFocusX / 100, params.dofFocusY / 100);
    gl.uniform1f(this.uniforms.u_skinSmooth, params.skinSmooth / 100);
    gl.uniform1f(this.uniforms.u_catchlight, params.catchlight / 100);
    gl.uniform1f(this.uniforms.u_skinWarmth, params.skinWarmth / 100);

    gl.uniform1f(this.uniforms.u_splitX, options.splitX ?? 1.0);
    gl.uniform1i(this.uniforms.u_showOriginal, options.showOriginal ? 1 : 0);
    gl.uniform1i(this.uniforms.u_showClipping, options.showClipping ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public dispose(): void {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
  }
}

/**
 * Creates a viewport-capped proxy canvas (max 2560x1440) for 60fps interactive rendering.
 */
export function createProxySource(img: HTMLImageElement, maxDim = 2048): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
} {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/**
 * Full-resolution export pipeline applying the exact same GLSL shader + crop + rotation.
 */
export function renderFullResolutionExport(
  img: HTMLImageElement,
  params: EditParams,
  crop: CropState,
  maxLongEdge: number | null
): HTMLCanvasElement {
  // 1. Render full-res image through WebGL
  const glCanvas = document.createElement('canvas');
  const renderer = new WebGLImageRenderer(glCanvas);
  renderer.uploadImage(img, img.naturalWidth, img.naturalHeight);
  renderer.render(params, { splitX: 1.0, showOriginal: false, showClipping: false });
  renderer.dispose();

  // 2. Apply crop and rotation
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = Math.max(1, crop.width * img.naturalWidth);
  const sh = Math.max(1, crop.height * img.naturalHeight);

  const scale = maxLongEdge ? Math.min(1, maxLongEdge / Math.max(sw, sh)) : 1;
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (Math.abs(crop.rotation) > 0.01) {
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((crop.rotation * Math.PI) / 180);
    ctx.drawImage(glCanvas, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH);
  } else {
    ctx.drawImage(glCanvas, sx, sy, sw, sh, 0, 0, outW, outH);
  }

  return outCanvas;
}

export interface HistogramBins {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
  maxCount: number;
  hasHighlightClip: boolean;
  hasShadowClip: boolean;
}

/**
 * Computes RGB & Luminance histogram from a downsampled snapshot of the WebGL canvas.
 */
export function computeHistogram(glCanvas: HTMLCanvasElement): HistogramBins {
  const sampleW = 160;
  const sampleH = Math.max(1, Math.round((glCanvas.height / Math.max(1, glCanvas.width)) * sampleW));
  const tmp = document.createElement('canvas');
  tmp.width = sampleW;
  tmp.height = sampleH;
  const ctx = tmp.getContext('2d')!;
  ctx.drawImage(glCanvas, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

  const r = new Uint32Array(64);
  const g = new Uint32Array(64);
  const b = new Uint32Array(64);
  const luma = new Uint32Array(64);

  let hiClipCount = 0;
  let shClipCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    const lv = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv);

    r[rv >> 2]++;
    g[gv >> 2]++;
    b[bv >> 2]++;
    luma[lv >> 2]++;

    if (rv >= 253 && gv >= 253 && bv >= 253) hiClipCount++;
    if (rv <= 2 && gv <= 2 && bv <= 2) shClipCount++;
  }

  let maxCount = 1;
  for (let i = 1; i < 63; i++) {
    maxCount = Math.max(maxCount, r[i], g[i], b[i], luma[i]);
  }

  const totalPixels = sampleW * sampleH;
  return {
    r,
    g,
    b,
    luma,
    maxCount,
    hasHighlightClip: hiClipCount > totalPixels * 0.005,
    hasShadowClip: shClipCount > totalPixels * 0.005,
  };
}
