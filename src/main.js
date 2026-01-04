import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import GUI from 'lil-gui';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Add fog for volumetric light effect
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// Camera - FIXED position, no orbit controls
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Environment Map
new RGBELoader().load('/hdri/studio.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
});

// ============================================
// GLASS MATERIAL (shared)
// ============================================

const glassMaterial = new THREE.MeshPhysicalMaterial({
  transmission: 1.0,
  roughness: 0.0,
  thickness: 5.0,
  ior: 2.0,
  dispersion: 5.0,
  metalness: 0.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.0,
  envMapIntensity: 1.0,
  side: THREE.DoubleSide,
});

// ============================================
// PRISM GROUP - Contains all prism objects
// ============================================

const prismGroup = new THREE.Group();
scene.add(prismGroup);

// ============================================
// OBJECT 1: Simple Single Pyramid
// ============================================

const singlePyramidGroup = new THREE.Group();
prismGroup.add(singlePyramidGroup);

const singlePyramidRadius = 1.2;
const singlePyramidHeight = 2.0;

const singlePyramidGeometry = new THREE.ConeGeometry(singlePyramidRadius, singlePyramidHeight, 4, 1);
singlePyramidGeometry.rotateY(Math.PI / 4);
const singlePyramid = new THREE.Mesh(singlePyramidGeometry, glassMaterial);
singlePyramidGroup.add(singlePyramid);

// ============================================
// OBJECT 2: Bi-pyramid (30% taller pyramids)
// ============================================

const biPyramidGroup = new THREE.Group();
prismGroup.add(biPyramidGroup);

const biPyramidRadius = 1.2;
const biPyramidHeight = 1.5 * 1.3; // 30% taller
let biPyramidGap = 0.15;

// Upper pyramid (apex pointing UP)
const upperPyramidGeometry = new THREE.ConeGeometry(biPyramidRadius, biPyramidHeight, 4, 1);
upperPyramidGeometry.rotateY(Math.PI / 4);
const upperPyramid = new THREE.Mesh(upperPyramidGeometry, glassMaterial);
upperPyramid.position.y = biPyramidHeight / 2 + biPyramidGap / 2;
biPyramidGroup.add(upperPyramid);

// Lower pyramid (apex pointing DOWN)
const lowerPyramidGeometry = new THREE.ConeGeometry(biPyramidRadius, biPyramidHeight, 4, 1);
lowerPyramidGeometry.rotateY(Math.PI / 4);
const lowerPyramid = new THREE.Mesh(lowerPyramidGeometry, glassMaterial);
lowerPyramid.rotation.x = Math.PI; // Flip upside down
lowerPyramid.position.y = -(biPyramidHeight / 2 + biPyramidGap / 2);
biPyramidGroup.add(lowerPyramid);

// Start with bi-pyramid visible
singlePyramidGroup.visible = false;
biPyramidGroup.visible = true;

// Apply default rotation (45° Y-axis, -30° X-axis)
prismGroup.rotation.x = Math.PI / 6;
prismGroup.rotation.y = Math.PI / 4;

// Function to update bi-pyramid gap
function updateBiPyramidGap(gap) {
  biPyramidGap = gap;
  upperPyramid.position.y = biPyramidHeight / 2 + gap / 2;
  lowerPyramid.position.y = -(biPyramidHeight / 2 + gap / 2);
}

// Function to switch between shapes
function setActiveShape(shapeName) {
  singlePyramidGroup.visible = (shapeName === 'Single Pyramid');
  biPyramidGroup.visible = (shapeName === 'Bi-Pyramid');
}

// ============================================
// LIGHTING - Fixed spotlight from far left (HIDDEN)
// ============================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.03);
scene.add(ambientLight);

// Spotlight - fixed FAR off-screen left, very thin beam
const spotLight = new THREE.SpotLight(0xffffff, 200);
spotLight.position.set(-15, 0, 0);
spotLight.target.position.set(0, 0, 0);
spotLight.angle = Math.PI / 80;
spotLight.penumbra = 0.1;
spotLight.decay = 0.5;
spotLight.distance = 50;
scene.add(spotLight);
scene.add(spotLight.target);

// ============================================
// INPUT BEAM - Hidden by default
// ============================================

const inputBeamLength = 14;
const inputBeamAngle = spotLight.angle;
const inputConeRadius = Math.tan(inputBeamAngle) * inputBeamLength;

const inputBeamGeometry = new THREE.ConeGeometry(inputConeRadius, inputBeamLength, 32, 1, true);

const inputBeamMaterial = new THREE.ShaderMaterial({
  uniforms: {
    opacity: { value: 0.25 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      float fade = 1.0 - vUv.y;
      fade = pow(fade, 1.2);
      float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
      edge = pow(edge, 0.3);
      float alpha = opacity * fade * edge;
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const inputBeam = new THREE.Mesh(inputBeamGeometry, inputBeamMaterial);
inputBeam.position.set(-15 + inputBeamLength / 2, 0, 0);
inputBeam.rotation.z = -Math.PI / 2;
inputBeam.visible = false;
scene.add(inputBeam);

// ============================================
// Dust particles
// ============================================

const particleCount = 300;
const particleGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.015,
  transparent: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// ============================================
// Settings
// ============================================

const settings = {
  // Shape selection
  shape: 'Bi-Pyramid',

  // Prism rotation - default 45° Y, 30° X
  prismRotateX: Math.PI / 6,
  prismRotateY: Math.PI / 4,
  prismRotateZ: 0,

  // Auto rotation
  autoRotate: true,
  autoRotateSpeed: 0.3,

  // Bi-pyramid gap
  biPyramidGap: biPyramidGap,

  // Input beam
  showInputBeam: false,
  inputBeamOpacity: 0.25,

  // Light
  lightIntensity: spotLight.intensity,

  // Atmosphere
  fogDensity: 0.02,
  particlesVisible: true,
};

// ============================================
// GUI
// ============================================

const gui = new GUI({ title: 'Prism Controls' });

// Shape selection - at the very top
const shapeFolder = gui.addFolder('Shape');
shapeFolder.add(settings, 'shape', ['Single Pyramid', 'Bi-Pyramid']).name('Type').onChange((v) => {
  setActiveShape(v);
});
shapeFolder.add(settings, 'biPyramidGap', 0, 1).name('Bi-Pyramid Gap').onChange((v) => {
  updateBiPyramidGap(v);
});
shapeFolder.open();

// Prism rotation
const prismFolder = gui.addFolder('Rotation');
prismFolder.add(settings, 'prismRotateX', -Math.PI, Math.PI).name('Rotate X').onChange((v) => {
  prismGroup.rotation.x = v;
});
prismFolder.add(settings, 'prismRotateY', -Math.PI, Math.PI).name('Rotate Y').onChange((v) => {
  prismGroup.rotation.y = v;
});
prismFolder.add(settings, 'prismRotateZ', -Math.PI, Math.PI).name('Rotate Z').onChange((v) => {
  prismGroup.rotation.z = v;
});
prismFolder.add(settings, 'autoRotate').name('Auto Rotate');
prismFolder.add(settings, 'autoRotateSpeed', 0.1, 2).name('Rotate Speed');
prismFolder.open();

// Optical properties
const optical = gui.addFolder('Glass Properties');
optical.add(glassMaterial, 'transmission', 0, 1).name('Transmission');
optical.add(glassMaterial, 'ior', 1.0, 3.0).name('IOR');
optical.add(glassMaterial, 'dispersion', 0, 10).name('Dispersion');
optical.add(glassMaterial, 'thickness', 0, 10).name('Thickness');
optical.add(glassMaterial, 'roughness', 0, 1).name('Roughness');

// Light settings
const lightFolder = gui.addFolder('Lighting');
lightFolder.add(settings, 'showInputBeam').name('Show Light Beam').onChange((v) => {
  inputBeam.visible = v;
});
lightFolder.add(settings, 'inputBeamOpacity', 0, 0.5).name('Beam Opacity').onChange((v) => {
  inputBeamMaterial.uniforms.opacity.value = v;
});
lightFolder.add(settings, 'lightIntensity', 0, 500).name('Light Intensity').onChange((v) => {
  spotLight.intensity = v;
});

// Atmosphere
const atmosphere = gui.addFolder('Atmosphere');
atmosphere.add(settings, 'fogDensity', 0, 0.08).name('Fog Density').onChange((v) => {
  scene.fog.density = v;
});
atmosphere.add(settings, 'particlesVisible').name('Dust Particles').onChange((v) => {
  particles.visible = v;
});

// ============================================
// Mouse drag to rotate prism
// ============================================

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', (e) => {
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - previousMousePosition.x;
  const deltaY = e.clientY - previousMousePosition.y;

  prismGroup.rotation.y += deltaX * 0.005;
  prismGroup.rotation.x += deltaY * 0.005;

  settings.prismRotateY = prismGroup.rotation.y;
  settings.prismRotateX = prismGroup.rotation.x;
  gui.controllersRecursive().forEach(c => c.updateDisplay());

  previousMousePosition = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mouseup', () => {
  isDragging = false;
});

renderer.domElement.addEventListener('mouseleave', () => {
  isDragging = false;
});

// ============================================
// Resize Handler
// ============================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// Animation Loop
// ============================================

function animate() {
  requestAnimationFrame(animate);

  // Auto rotate prism
  if (settings.autoRotate && !isDragging) {
    prismGroup.rotation.y += settings.autoRotateSpeed * 0.01;
    settings.prismRotateY = prismGroup.rotation.y;
  }

  particles.rotation.y += 0.0001;
  renderer.render(scene, camera);
}
animate();
