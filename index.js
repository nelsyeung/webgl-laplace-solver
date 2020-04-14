import './styles.css';

const $colors = document.getElementById('colors');
const $grid = document.getElementById('grid');
const $iter = document.getElementById('iter');
const $message = document.getElementById('message');
let requestId;

function clearCanvas(gl) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  console.error(gl.getShaderInfoLog(shader)); // eslint-disable-line
  gl.deleteShader(shader);
  return undefined;
}

function initPrograms(gl, programsDesc) {
  const programsInfo = {};

  Object.keys(programsDesc).forEach((id) => {
    const vertexShader = loadShader(
      gl,
      gl.VERTEX_SHADER,
      programsDesc[id].vsSrc,
    );
    const fragmentShader = loadShader(
      gl,
      gl.FRAGMENT_SHADER,
      programsDesc[id].fsSrc,
    );
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      programsInfo[id] = {};
      programsInfo[id].program = program;
      programsDesc[id].attribs.forEach((attrib) => {
        programsInfo[id][attrib] = gl.getAttribLocation(
          programsInfo[id].program,
          attrib,
        );
        gl.enableVertexAttribArray(programsInfo[id][attrib]);
      });

      programsDesc[id].uniforms.forEach((uniform) => {
        programsInfo[id][uniform] = gl.getUniformLocation(
          programsInfo[id].program,
          uniform,
        );
      });
    } else {
      console.log(gl.getProgramInfoLog(program)); // eslint-disable-line
      gl.deleteProgram(program);
    }
  });

  return programsInfo;
}

function initBuffers(gl, programsInfo) {
  const buffersInfo = {
    vao: gl.createVertexArray(),
  };

  gl.bindVertexArray(buffersInfo.vao);

  // Position buffer
  const positionBuffer = gl.createBuffer();
  const positions = [
    0, 0,
    0, 1,
    1, 0,
    0, 1,
    1, 1,
    1, 0,
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(programsInfo.init.aPosition);
  gl.vertexAttribPointer(programsInfo.init.aPosition, 2, gl.FLOAT, false, 0, 0);

  buffersInfo.position = {
    buffer: positionBuffer,
    count: 6,
  };

  // Texture coordinate buffer
  const texCoordBuffer = gl.createBuffer();
  const texCoord = [
    0, 0,
    0, 1,
    1, 0,
    0, 1,
    1, 1,
    1, 0,
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoord), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(programsInfo.init.aTexCoord);
  gl.vertexAttribPointer(programsInfo.init.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  buffersInfo.texCoord = {
    buffer: texCoordBuffer,
  };

  return buffersInfo;
}

function attachTexture(gl, framebuffer, texIndex) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D, framebuffer.textures[texIndex], framebuffer.mipLevel,
  );
}

function initFramebuffer(gl) {
  const framebuffer = {
    fbo: gl.createFramebuffer(),
    mipLevel: 0,
    size: 32,
    textures: [],
  };

  for (let i = 0; i < 2; i += 1) {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D, framebuffer.mipLevel, gl.RGBA, gl.canvas.width,
      gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null,
    );
    framebuffer.textures.push(texture);
  }

  gl.bindTexture(gl.TEXTURE_2D, null);

  return framebuffer;
}

function drawSolution(gl, programsInfo, buffersInfo, texture) {
  gl.useProgram(programsInfo.draw.program);
  gl.bindVertexArray(buffersInfo.vao);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLES, 0, buffersInfo.position.count);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function gpu(gl, programsInfo, buffersInfo, iter) {
  $message.innerHTML = 'Running with GPU...';

  const t0 = performance.now();
  const framebuffer = initFramebuffer(gl);
  let count = 0;

  // Initialise function
  gl.useProgram(programsInfo.init.program);
  gl.bindVertexArray(buffersInfo.vao);
  attachTexture(gl, framebuffer, 0);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLES, 0, buffersInfo.position.count);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  function updateState() {
    if (count >= iter) {
      const t1 = performance.now();
      $message.innerHTML = `GPU took ${t1 - t0} milliseconds`;
      return;
    }

    requestId = undefined;
    count += 1;

    gl.useProgram(programsInfo.solver.program);
    gl.bindVertexArray(buffersInfo.vao);
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.textures[0]);
    attachTexture(gl, framebuffer, 1);
    clearCanvas(gl);
    gl.drawArrays(gl.TRIANGLES, 0, buffersInfo.position.count);
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.textures[0]);
    gl.copyTexImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.canvas.width,
      gl.canvas.height, 0,
    );
    drawSolution(gl, programsInfo, buffersInfo, framebuffer.textures[0]);

    if (!requestId) {
      requestId = requestAnimationFrame(updateState);
    }
  }

  updateState();
}

function cpu(gl, programsInfo, buffersInfo, grid, iter) {
  $message.innerHTML = 'Running with CPU...';

  const t0 = performance.now();
  const data = [[], []];
  const texture = gl.createTexture();
  let count = 0;

  // Initialise function
  for (let i = 0; i < grid; i += 1) {
    data[0].push([]);
    data[1].push([]);

    for (let j = 0; j < grid; j += 1) {
      const x = j / grid;
      const y = i / grid;
      const dist = [
        [x - 0.3, y - 0.5],
        [x - 0.7, y - 0.5],
      ];
      const distSq = [
        (dist[0][0] * dist[0][0]) + (dist[0][1] * dist[0][1]),
        (dist[1][0] * dist[1][0]) + (dist[1][1] * dist[1][1]),
      ];
      const r = 0.05;
      const rSq = r * r;

      if (distSq[0] < rSq) {
        data[0][i].push([0.999999999999, 1]);
      } else if (distSq[1] < rSq) {
        data[0][i].push([0.0, 1]);
      } else {
        data[0][i].push([0.5, 0]);
      }

      data[1][i].push(data[0][i][j]);
    }
  }

  function floatToRGB(value) {
    const rgb = [
      value % 1,
      (value * 255.0) % 1,
      (value * 65025) % 1,
    ];

    return [
      parseInt((rgb[0] - (rgb[1] / 255)) * 255, 10),
      parseInt((rgb[1] - (rgb[2] / 255)) * 255, 10),
      parseInt(rgb[2] * 255, 10),
    ];
  }

  function updateState() {
    if (count >= iter) {
      const t1 = performance.now();
      $message.innerHTML = `CPU took ${t1 - t0} milliseconds`;
      return;
    }

    requestId = undefined;
    count += 1;
    const texData = [];

    for (let i = 0; i < grid; i += 1) {
      for (let j = 0; j < grid; j += 1) {
        if (data[0][i][j][1] === 0) {
          const n = j === 0 ? data[0][i][grid - 1][0] : data[0][i][j - 1][0];
          const e = i === 0 ? data[0][grid - 1][j][0] : data[0][i - 1][j][0];
          const s = j === grid - 1 ? data[0][i][0][0] : data[0][i][j + 1][0];
          const w = i === grid - 1 ? data[0][0][j][0] : data[0][i + 1][j][0];

          data[1][i][j][0] = (n + e + s + w) / 4.0;
        } else {
          [data[1][i][j][0]] = data[0][i][j];
        }

        floatToRGB(data[1][i][j][0]).forEach(color => texData.push(color));
      }
    }

    let tmp = data[0];
    [tmp, data[0]] = data;
    data[1] = tmp;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGB, grid, grid, 0, gl.RGB, gl.UNSIGNED_BYTE,
      new Uint8Array(texData),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    drawSolution(gl, programsInfo, buffersInfo, texture);

    if (!requestId) {
      requestId = requestAnimationFrame(updateState);
    }
  }

  updateState();
}

function main(gl) {
  const colors = $colors.options[$colors.selectedIndex].value;
  const method = document.querySelector('input[name="method"]:checked').value;
  const iter = parseInt($iter.value, 10);
  let grid = parseInt($grid.value, 10);
  let colorStr;

  if (grid > gl.canvas.height) {
    grid = gl.canvas.height;
    $grid.value = grid;
  }

  if (colors === 'rgb') {
    colorStr = 'color.r, color.g, color.b';
  } else if (colors === 'red') {
    colorStr = 'color.r, 0, 0';
  } else if (colors === 'rgrey') {
    colorStr = 'color.r, color.r, color.r';
  } else if (colors === 'green') {
    colorStr = '0, color.g, 0';
  } else if (colors === 'ggrey') {
    colorStr = 'color.g, color.g, color.g';
  } else if (colors === 'blue') {
    colorStr = '0, 0, color.b';
  } else if (colors === 'bgrey') {
    colorStr = 'color.b, color.b, color.b';
  }

  const vsSrc = `#version 300 es
    in vec4 aPosition;
    in vec2 aTexCoord;

    out vec2 vTexCoord;

    const vec4 translation = vec4(-0.5, -0.5, 0, 0);
    const vec4 scaling = vec4(2, 2, 1, 1);

    void main(void) {
      gl_Position = (aPosition + translation) * scaling;
      vTexCoord = aTexCoord;
    }
  `;

  const fsInitSrc = `#version 300 es
    precision highp float;

    in vec2 vTexCoord;

    out vec4 fragColor;

    void main(void) {
      vec2 d1 = vTexCoord - vec2(0.3, 0.5);
      vec2 d2 = vTexCoord - vec2(0.7, 0.5);
      float dist1Sq = dot(d1, d1);
      float dist2Sq = dot(d2, d2);
      float r = 0.05;
      float rSq = r * r;

      if (dist1Sq < rSq) {
        fragColor = vec4(1.0, 1.0, 1.0, 1.0);
      } else if (dist2Sq < rSq) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        fragColor = vec4(0.5, 0.5, 0.5, 0.0);
      }
    }
  `;

  const fsSolverSrc = `#version 300 es
    precision highp float;

    in vec2 vTexCoord;

    uniform sampler2D uTexture;

    out vec4 fragColor;

    vec3 floatToRGB(float value) {
      const vec3 bitShifts = vec3(1.0, 255.0, 65025.0);
      vec3 rgb = fract(bitShifts * value);
      rgb -= rgb.yzz * vec2(1.0 / 255.0, 0.0).xxy;
      return rgb;
    }

    void main(void) {
      float delta = 1.0 / ${grid.toFixed(1)};
      vec4 color = texture(uTexture, vTexCoord);

      if (color.a == 0.0) {
        vec4 n = texture(uTexture, vec2(vTexCoord.s, vTexCoord.t + delta));
        vec4 e = texture(uTexture, vec2(vTexCoord.s + delta, vTexCoord.t));
        vec4 s = texture(uTexture, vec2(vTexCoord.s, vTexCoord.t - delta));
        vec4 w = texture(uTexture, vec2(vTexCoord.s - delta, vTexCoord.t));

        float value = ((w.r + e.r + n.r + s.r) / 4.0) +
          ((w.g + e.g + n.g + s.g) / 1020.0) +
          ((w.b + e.b + n.b + s.r) / 260100.0);
        fragColor = vec4(floatToRGB(value), 0.0);
      } else {
        fragColor = color;
      }
    }
  `;

  const fsDrawSrc = `#version 300 es
    precision highp float;

    in vec2 vTexCoord;

    uniform sampler2D uTexture;

    out vec4 fragColor;

    void main(void) {
      vec4 color = texture(uTexture, vTexCoord);
      fragColor = vec4(${colorStr}, 1);
    }
  `;

  const programsDesc = {
    init: {
      vsSrc,
      fsSrc: fsInitSrc,
      attribs: ['aPosition', 'aTexCoord'],
      uniforms: [],
    },
    solver: {
      vsSrc,
      fsSrc: fsSolverSrc,
      attribs: ['aPosition', 'aTexCoord'],
      uniforms: ['uTexture'],
    },
    draw: {
      vsSrc,
      fsSrc: fsDrawSrc,
      attribs: ['aPosition', 'aTexCoord'],
      uniforms: ['uTexture'],
    },
  };

  const programsInfo = initPrograms(gl, programsDesc);
  const buffersInfo = initBuffers(gl, programsInfo);

  if (requestId) {
    cancelAnimationFrame(requestId);
    requestId = undefined;
  }

  if (method === 'gpu') {
    gpu(gl, programsInfo, buffersInfo, iter);
  } else {
    cpu(gl, programsInfo, buffersInfo, grid, iter);
  }
}

(() => {
  const gl = document.getElementById('canvas').getContext('webgl2');

  if (!gl) {
    return;
  }

  // Setup and clear canvas
  gl.canvas.width = gl.canvas.clientWidth;
  gl.canvas.height = gl.canvas.clientHeight;
  clearCanvas(gl);

  main(gl);

  document.getElementById('start').addEventListener('click', () => main(gl));
})();
