(function () {
  const container = document.getElementById('dogAvatar');
  if (!container || typeof THREE === 'undefined' || typeof gsap === 'undefined') return;

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ── Scene + Camera ────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 1.6, 6.2);
  camera.lookAt(0, 1.05, 0);

  // ── Lights ────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xfff0f8, 3.5));

  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far  = 30;
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top   =  5;
  key.shadow.bias = -0.001;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffe0f5, 1.0);
  fill.position.set(-4, 3, 4);
  scene.add(fill);

  // ── Toon gradient — light shadows so white stays white ───────────────────
  const gradMap = (function () {
    var d = new Uint8Array([200, 230, 255]);
    var t = new THREE.DataTexture(d, 3, 1, THREE.LuminanceFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }());

  // ── Materials ─────────────────────────────────────────────────────────────
  function toon(col, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color: col, gradientMap: gradMap }, opts || {}));
  }
  var mWhite   = toon(0xffffff);
  var mPink    = toon(0xff69b4);
  var mHotPink = toon(0xff1493);
  var mSoftPnk = toon(0xffb6d9);
  var mDark    = toon(0x1a0a2e);
  var mNose    = toon(0x2d1040);
  var mBlush   = toon(0xffb6d9, { transparent: true, opacity: 0.5 });
  var mWhiteB  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var mOutline = new THREE.MeshBasicMaterial({ color: 0x1a0a2e, side: THREE.BackSide });

  // ── Geometry helpers ──────────────────────────────────────────────────────
  function sphere(r, mat, sx, sy, sz) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
    if (sx) m.scale.set(sx, sy || sx, sz || sx);
    m.castShadow = true;
    return m;
  }
  function box(w, h, d, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  }
  function torus(R, r, mat) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 26), mat);
    m.castShadow = true;
    return m;
  }
  // Adds a black backface-outline child to a mesh
  function outlined(mesh, s) {
    var o = new THREE.Mesh(mesh.geometry, mOutline);
    o.scale.setScalar(s || 1.1);
    mesh.add(o);
    return mesh;
  }
  function place(obj, x, y, z, rx, ry, rz) {
    if (x !== undefined) obj.position.set(x, y || 0, z || 0);
    if (rx !== undefined) obj.rotation.set(rx, ry || 0, rz || 0);
    return obj;
  }
  function grp(x, y, z) {
    return place(new THREE.Group(), x || 0, y || 0, z || 0);
  }

  // ── Floor ─────────────────────────────────────────────────────────────────
  var grid = new THREE.GridHelper(10, 22, 0xf0c8e0, 0xf5d8ec);
  grid.position.y = -0.72;
  scene.add(grid);

  var shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.25, transparent: true })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.71;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // ── Dog root ──────────────────────────────────────────────────────────────
  var dog = grp(0, 0, 0);
  scene.add(dog);

  // ── Body ──────────────────────────────────────────────────────────────────
  var bodyG = grp(0, 0.18, 0);
  dog.add(bodyG);

  bodyG.add(outlined(sphere(0.58, mWhite, 1.0, 1.12, 0.88)));
  // Pink body spot
  var bspot = sphere(0.26, mPink, 1.0, 0.75, 0.45);
  place(bspot, -0.28, 0.08, 0.48);
  bodyG.add(bspot);
  // Haunches
  var haunch = outlined(sphere(0.44, mWhite, 1.18, 0.92, 1.0));
  place(haunch, 0, -0.34, -0.08);
  bodyG.add(haunch);
  // Front sitting paws
  [-0.28, 0.28].forEach(function (x) {
    var paw = outlined(sphere(0.17, mWhite, 1.1, 0.72, 1.05));
    place(paw, x, -0.6, 0.38);
    bodyG.add(paw);
    var pad = sphere(0.07, mPink);
    place(pad, x, -0.6, 0.56);
    bodyG.add(pad);
  });

  // ── Collar + bow tie ──────────────────────────────────────────────────────
  var collar = torus(0.23, 0.055, mHotPink);
  place(collar, 0, 0.7, 0.05, Math.PI / 2 - 0.28, 0, 0);
  dog.add(collar);

  var bowG = grp(0, 0.68, 0.28);
  dog.add(bowG);
  var bl = sphere(0.12, mHotPink, 1.35, 0.72, 0.5);
  place(bl, -0.1, 0, 0);
  bowG.add(bl);
  var br = sphere(0.12, mHotPink, 1.35, 0.72, 0.5);
  place(br, 0.1, 0, 0);
  bowG.add(br);
  bowG.add(sphere(0.07, mPink));

  var badge = sphere(0.1, mHotPink);
  place(badge, 0, 0.68, 0.4);
  dog.add(badge);

  // ── Head ──────────────────────────────────────────────────────────────────
  var headG = grp(0, 1.2, 0.06);
  dog.add(headG);

  headG.add(outlined(sphere(0.63, mWhite, 1.0, 1.0, 0.96)));

  // Forehead patch
  var fpatch = sphere(0.24, mPink, 1.0, 0.88, 0.45);
  place(fpatch, 0, 0.3, 0.54);
  headG.add(fpatch);

  // Snout
  var snoutG = grp(0, -0.09, 0.55);
  headG.add(snoutG);
  snoutG.add(outlined(sphere(0.27, mWhite, 1.1, 0.82, 0.9)));
  // Nose
  var nose = sphere(0.1, mNose, 1.18, 0.82, 1.0);
  place(nose, 0, 0.08, 0.26);
  snoutG.add(nose);
  // Mouth dots
  [[-0.1, -0.16, 0.25], [0.1, -0.16, 0.25], [0, -0.12, 0.27]].forEach(function (p) {
    var dot = sphere(0.033, mNose);
    place(dot, p[0], p[1], p[2]);
    snoutG.add(dot);
  });

  // Cheek blush
  [-0.43, 0.43].forEach(function (x) {
    var cheek = sphere(0.16, mBlush, 1.0, 0.65, 0.45);
    place(cheek, x, -0.09, 0.52);
    headG.add(cheek);
  });

  // ── Eyes (own group for blink) ────────────────────────────────────────────
  var eyeG = grp(0, 0, 0);
  headG.add(eyeG);

  [[-0.25, 0.11, 0.52], [0.25, 0.11, 0.52]].forEach(function (p) {
    var x = p[0], y = p[1], z = p[2];
    var ew = outlined(sphere(0.145, mWhite, 1.0, 1.12, 0.58), 1.14);
    place(ew, x, y, z);
    eyeG.add(ew);
    var iris = sphere(0.12, mDark, 1.0, 1.18, 0.5);
    place(iris, x, y, z + 0.03);
    eyeG.add(iris);
    var hl1 = sphere(0.052, mWhiteB);
    place(hl1, x + 0.04, y + 0.055, z + 0.07);
    eyeG.add(hl1);
    var hl2 = sphere(0.026, mWhiteB);
    place(hl2, x - 0.03, y + 0.01, z + 0.08);
    eyeG.add(hl2);
    var ic = sphere(0.034, mSoftPnk);
    place(ic, x > 0 ? x - 0.085 : x + 0.085, y - 0.02, z + 0.01);
    eyeG.add(ic);
  });

  // Eyebrows
  [[-0.26, 0.28, 0.52, 0.22], [0.26, 0.28, 0.52, -0.22]].forEach(function (p) {
    var br2 = box(0.17, 0.045, 0.05, mDark);
    place(br2, p[0], p[1], p[2], 0, 0, p[3]);
    headG.add(br2);
  });

  // ── Ears (child of headG) ─────────────────────────────────────────────────
  [[-0.46, 0.1, 0.18], [0.46, 0.1, -0.18]].forEach(function (p) {
    var eg = grp(p[0], 0.38, -0.04);
    eg.rotation.set(p[1], 0, p[2]);
    var eouter = outlined(sphere(0.29, mPink, 0.72, 1.32, 0.33));
    place(eouter, 0, -0.18, 0);
    eg.add(eouter);
    var einner = sphere(0.2, mSoftPnk, 0.6, 1.1, 0.28);
    place(einner, 0, -0.15, 0.04);
    eg.add(einner);
    headG.add(eg);
  });

  // ── Right waving arm ──────────────────────────────────────────────────────
  var waveG = grp(0.64, 0.62, 0.08);
  waveG.rotation.z = 0.55;
  dog.add(waveG);

  var uarmR = outlined(sphere(0.17, mWhite, 0.82, 1.4, 0.82));
  place(uarmR, 0, 0.12, 0);
  waveG.add(uarmR);

  var elbowG = grp(0, 0.35, 0);
  elbowG.rotation.z = -0.75;
  waveG.add(elbowG);

  var larmR = outlined(sphere(0.15, mWhite, 0.82, 1.3, 0.82));
  place(larmR, 0, 0.2, 0);
  elbowG.add(larmR);
  var pawR = outlined(sphere(0.19, mWhite, 1.1, 0.88, 0.88));
  place(pawR, 0, 0.44, 0);
  elbowG.add(pawR);
  var padC = sphere(0.075, mPink); place(padC, 0, 0.44, 0.16); elbowG.add(padC);
  var padL = sphere(0.042, mPink); place(padL, -0.07, 0.52, 0.14); elbowG.add(padL);
  var padR2 = sphere(0.042, mPink); place(padR2, 0.07, 0.52, 0.14); elbowG.add(padR2);

  // ── Left arm ──────────────────────────────────────────────────────────────
  var leftArmG = grp(-0.62, 0.52, 0.1);
  leftArmG.rotation.set(0.35, 0, 0.28);
  dog.add(leftArmG);
  var uarmL = outlined(sphere(0.17, mWhite, 0.82, 1.32, 0.82));
  place(uarmL, 0, -0.08, 0);
  leftArmG.add(uarmL);
  var pawL = outlined(sphere(0.16, mWhite, 1.1, 0.88, 0.88));
  place(pawL, 0, -0.3, 0.1);
  leftArmG.add(pawL);

  // ── Tail ──────────────────────────────────────────────────────────────────
  var tailG = grp(0.42, 0.0, -0.4);
  tailG.rotation.z = -0.3;
  dog.add(tailG);
  var ts1 = outlined(sphere(0.14, mPink, 0.78, 1.45, 0.78));
  place(ts1, 0.1, 0.22, 0, 0, 0, -0.55);
  tailG.add(ts1);
  var ts2 = outlined(sphere(0.1, mHotPink, 0.78, 1.2, 0.78));
  place(ts2, 0.28, 0.44, 0, 0, 0, -0.3);
  tailG.add(ts2);

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    var w = container.clientWidth  || 260;
    var h = container.clientHeight || 320;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  // ── Render loop ───────────────────────────────────────────────────────────
  (function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); }());

  // ── Idle system ───────────────────────────────────────────────────────────
  var idleActive = false;
  var pool = ['wave','wave','tilt','wag','blink','bob','wave','tilt'];
  var poolIdx = 0;

  function killAll() {
    idleActive = false;
    [dog.position, dog.rotation, headG.rotation, tailG.rotation,
     waveG.rotation, elbowG.rotation, leftArmG.rotation,
     bodyG.position, eyeG.scale].forEach(function (o) { gsap.killTweensOf(o); });
  }

  function nextIdle() {
    if (!idleActive) return;
    var name = pool[poolIdx++ % pool.length];
    idleBehaviors[name]();
  }

  var idleBehaviors = {
    wave: function () {
      var tl = gsap.timeline({ onComplete: nextIdle });
      tl.to(waveG.rotation, { z: 0.85, duration: 0.35, ease: 'back.out(2)' });
      tl.to(waveG.rotation, { z: 0.35, duration: 0.3,  ease: 'sine.inOut' });
      tl.to(waveG.rotation, { z: 0.8,  duration: 0.28, ease: 'sine.inOut' });
      tl.to(waveG.rotation, { z: 0.3,  duration: 0.28, ease: 'sine.inOut' });
      tl.to(waveG.rotation, { z: 0.55, duration: 0.35, ease: 'power2.out' });
      tl.to(bodyG.position, { y: 0.23, duration: 0.5, ease: 'sine.inOut', repeat: 3, yoyo: true }, 0);
      tl.to(tailG.rotation, { z: 0.2,  duration: 0.18, ease: 'none', repeat: 6, yoyo: true }, 0);
    },
    tilt: function () {
      var tl = gsap.timeline({ onComplete: nextIdle });
      tl.to(headG.rotation, { z:  0.24, duration: 0.45, ease: 'back.out(1.5)' });
      tl.to(headG.rotation, { z: -0.2,  duration: 0.75, ease: 'power2.inOut' });
      tl.to(headG.rotation, { z:  0,    duration: 0.45, ease: 'power2.in' });
    },
    wag: function () {
      var tl = gsap.timeline({ onComplete: nextIdle });
      tl.to(tailG.rotation, { z: 0.55, duration: 0.09, ease: 'none', repeat: 14, yoyo: true });
      tl.to(dog.rotation,   { z: 0.04, duration: 0.18, ease: 'none', repeat: 7,  yoyo: true }, 0);
    },
    bob: function () {
      var tl = gsap.timeline({ onComplete: nextIdle });
      tl.to(dog.position,   { y: -0.08, duration: 0.5, ease: 'power2.out' });
      tl.to(dog.position,   { y:  0,    duration: 0.5, ease: 'power2.in'  });
      tl.to(headG.rotation, { x:  0.14, duration: 0.45, ease: 'power2.out' }, 0);
      tl.to(headG.rotation, { x:  0,    duration: 0.45, ease: 'power2.in'  }, '>');
    },
    blink: function () {
      var tl = gsap.timeline({ onComplete: nextIdle });
      tl.to(eyeG.scale, { y: 0.12, duration: 0.07, ease: 'power2.in'  });
      tl.to(eyeG.scale, { y: 1.0,  duration: 0.1,  ease: 'power2.out' });
      tl.to({}, { duration: 1.2 });
      tl.to(eyeG.scale, { y: 0.12, duration: 0.07, ease: 'power2.in'  });
      tl.to(eyeG.scale, { y: 1.0,  duration: 0.1,  ease: 'power2.out' });
    },
  };

  function startIdle() {
    idleActive = true;
    gsap.to(dog.rotation, { y: 0.18, duration: 0.7, ease: 'power2.out', onComplete: nextIdle });
  }

  function returnIdle(tl) {
    tl.to(dog.position,   { y: 0,    duration: 0.5, ease: 'power2.out' }, '>');
    tl.to(headG.rotation, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'power2.out' }, '<');
    tl.to(tailG.rotation, { z: -0.3, duration: 0.4, ease: 'power2.out' }, '<');
    tl.to(waveG.rotation, { z: 0.55, duration: 0.4, ease: 'power2.out' }, '<');
    tl.to(dog.rotation,   { z: 0,    duration: 0.4, ease: 'power2.out' }, '<');
    tl.to(eyeG.scale,     { y: 1,    duration: 0.3, ease: 'power2.out' }, '<');
    tl.call(function () { startIdle(); });
  }

  startIdle();

  // ── Reactions ─────────────────────────────────────────────────────────────
  function celebrate() {
    killAll();
    var tl = gsap.timeline();
    tl.to(dog.rotation, { y: 0, duration: 0.3, ease: 'power2.out' });
    tl.to(dog.position, { y: 0.52, duration: 0.28, ease: 'power2.out' });
    tl.to(dog.position, { y: 0,    duration: 0.38, ease: 'bounce.out' });
    tl.to(dog.position, { y: 0.3,  duration: 0.2,  ease: 'power2.out' });
    tl.to(dog.position, { y: 0,    duration: 0.3,  ease: 'bounce.out' });
    tl.to(waveG.rotation, { z: 1.1, duration: 0.09, ease: 'none', repeat: 11, yoyo: true }, 0);
    tl.to(tailG.rotation, { z: 0.6, duration: 0.08, ease: 'none', repeat: 13, yoyo: true }, 0);
    tl.to(headG.rotation, { z: 0.22, duration: 0.25, ease: 'back.out(2)' }, 0.25);
    returnIdle(tl);
  }

  function nod() {
    killAll();
    var tl = gsap.timeline();
    tl.to(dog.rotation,   { y: 0, duration: 0.3, ease: 'power2.out' });
    tl.to(headG.rotation, { x:  0.44, duration: 0.26, ease: 'power2.out' });
    tl.to(headG.rotation, { x: -0.08, duration: 0.2,  ease: 'power2.in'  });
    tl.to(headG.rotation, { x:  0.36, duration: 0.24, ease: 'power2.out' });
    tl.to(headG.rotation, { x:  0,    duration: 0.22, ease: 'power2.in'  });
    tl.to(tailG.rotation, { z: 0.3, duration: 0.14, ease: 'none', repeat: 5, yoyo: true }, 0);
    returnIdle(tl);
  }

  function sad() {
    killAll();
    var tl = gsap.timeline();
    tl.to(dog.rotation,   { y: 0, duration: 0.3, ease: 'power2.out' });
    tl.to(headG.rotation, { x: 0.52, z: 0.1, duration: 0.65, ease: 'power2.out' });
    tl.to(tailG.rotation, { z: -0.65, duration: 0.6,  ease: 'power2.out' }, '<');
    tl.to(dog.position,   { y: -0.14, duration: 0.6,  ease: 'power2.out' }, '<');
    tl.to(waveG.rotation, { z: -0.3,  duration: 0.5,  ease: 'power2.out' }, '<');
    tl.to(eyeG.scale,     { y: 0.7,   duration: 0.5,  ease: 'power2.out' }, '<');
    tl.to({}, { duration: 1.6 });
    returnIdle(tl);
  }

  // ── Mouse interaction ─────────────────────────────────────────────────────
  var mouseMode = false;
  var tHY = gsap.quickTo(headG.rotation, 'y', { duration: 0.5, ease: 'power3.out' });
  var tHX = gsap.quickTo(headG.rotation, 'x', { duration: 0.5, ease: 'power3.out' });
  var tDY = gsap.quickTo(dog.rotation,   'y', { duration: 0.9, ease: 'power3.out' });

  container.addEventListener('mouseenter', function () {
    if (mouseMode) return;
    mouseMode = true;
    idleActive = false;
    gsap.killTweensOf(headG.rotation);
    gsap.killTweensOf(dog.rotation);
    gsap.to(dog.position,   { y: 0.1,  duration: 0.3, ease: 'back.out(2)' });
    gsap.to(waveG.rotation, { z: 0.9,  duration: 0.3, ease: 'back.out(2)' });
    gsap.to(tailG.rotation, { z: 0.45, duration: 0.25 });
  });

  container.addEventListener('mousemove', function (e) {
    if (!mouseMode) return;
    var r = container.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width)  * 2 - 1;
    var ny = ((e.clientY - r.top)  / r.height) * 2 - 1;
    tHY(nx * 0.52); tHX(ny * 0.2); tDY(nx * 0.22);
  });

  container.addEventListener('mouseleave', function () {
    if (!mouseMode) return;
    mouseMode = false;
    gsap.to(headG.rotation, { x: 0, y: 0, duration: 0.6, ease: 'power2.out' });
    gsap.to(tailG.rotation, { z: -0.3, duration: 0.5 });
    gsap.to(waveG.rotation, { z: 0.55, duration: 0.5 });
    gsap.to(dog.position,   { y: 0, duration: 0.5 });
    gsap.delayedCall(0.7, function () { if (!mouseMode) startIdle(); });
  });

  // ── Public API ────────────────────────────────────────────────────────────
  var lastClass = null;
  window.setDogReaction = function (cls) {
    if (cls === lastClass) return;
    lastClass = cls;
    if      (cls === 'happy') celebrate();
    else if (cls === 'alert') nod();
    else if (cls === 'sad')   sad();
    setTimeout(function () { lastClass = null; }, 6000);
  };
}());
