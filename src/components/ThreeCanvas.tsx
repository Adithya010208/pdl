import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Eye, Flag, MapPin, AlertTriangle, ShieldCheck, CloudRain, Moon, Sun, Compass, Lightbulb, Award, FileText, CheckCircle2, Activity, Sparkles, X, Download, UserCheck } from 'lucide-react';
import { VehicleTelemetry, TelemetrySample, DrivingSessionData, DriverProfile } from '../types/simulator';
import { ProceduralVehicleAudio } from '../utils/audioEngine';

interface ThreeCanvasProps {
  onTelemetryUpdate?: (telemetry: VehicleTelemetry) => void;
  onRequestOpenCode?: (scriptId: string) => void;
  onNavigateToDashboard?: () => void;
}

interface RouteCheckpoint {
  id: number;
  x: number;
  z: number;
  radius: number;
  passed: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ onTelemetryUpdate, onNavigateToDashboard }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'driving' | 'paused'>('menu');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<'chase' | 'cockpit' | 'hood'>('chase');

  // Phase 7: Procedural Audio Engine & Turn Indicators
  const audioEngineRef = useRef<ProceduralVehicleAudio | null>(null);
  const blinkStateRef = useRef<{ left: boolean; right: boolean; timer: number; on: boolean }>({
    left: false,
    right: false,
    timer: 0,
    on: false
  });

  // Phase 4: Training Scenarios & Headlights
  const [selectedScenario, setSelectedScenario] = useState<'city' | 'highway' | 'rain' | 'night'>('city');
  const [headlightsOn, setHeadlightsOn] = useState<boolean>(false);
  const scenarioRef = useRef<'city' | 'highway' | 'rain' | 'night'>('city');
  scenarioRef.current = selectedScenario;
  const headlightsRef = useRef<boolean>(false);
  headlightsRef.current = headlightsOn;

  // Checkpoint route progression (Phase 2)
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState<number>(0);
  const [isDestinationReached, setIsDestinationReached] = useState<boolean>(false);
  const [distanceToNextTarget, setDistanceToNextTarget] = useState<number>(45);

  // Phase 3 & 5: Driving Score, Telemetry & Assessment State
  const [drivingScore, setDrivingScore] = useState<number>(100);
  const [activeAlert, setActiveAlert] = useState<{ message: string; points: number } | null>(null);
  const [currentAccel, setCurrentAccel] = useState<number>(0);
  const [showAssessmentModal, setShowAssessmentModal] = useState<boolean>(false);

  // Phase 5 Telemetry and Violation History Refs
  const telemetrySamplesRef = useRef<TelemetrySample[]>([]);
  const violationStatsRef = useRef({
    collisions: 0,
    redLights: 0,
    wrongLanes: 0,
    overspeeds: 0,
    hardBrakes: 0,
    aggressiveAccels: 0
  });
  const sessionStartTimeRef = useRef<number>(performance.now());
  const previousSpeedMsRef = useRef<number>(0);
  const lastHardBrakeTimeRef = useRef<number>(-10000);
  const lastAggressiveAccelTimeRef = useRef<number>(-10000);
  const telemetrySampleTimerRef = useRef<number>(0);
  const maxSpeedKmhRef = useRef<number>(0);
  const hasSavedSessionRef = useRef<boolean>(false);

  // Telemetry state for React HUD
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    engineRpm: 800,
    currentGear: 'P',
    steerAngle: 0,
    motorTorque: 0,
    brakeTorque: 0,
    isHandbraking: false,
    distanceTraveled: 0
  });

  // Keys ref
  const keysRef = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false
  });

  // Internal vehicle physics simulation state
  const physicsRef = useRef({
    x: 0,
    y: 0.35,
    z: 0,
    vx: 0,
    vz: 0,
    heading: 0,
    speed: 0,
    steerAngle: 0,
    maxSteerAngle: THREE.MathUtils.degToRad(32),
    wheelRotation: 0,
    maxSpeedForward: 130 / 3.6,
    maxSpeedReverse: 35 / 3.6,
    acceleration: 14.0,
    brakeForce: 28.0,
    friction: 0.985,
    distance: 0,
    gear: 'N' as 'P' | 'R' | 'N' | 'D'
  });

  // Phase 3 Violation Tracking Refs
  const currentSignalColorRef = useRef<'green' | 'yellow' | 'red'>('green');
  const overspeedTimerRef = useRef(0);
  const overspeedPenaltyLoggedRef = useRef(false);
  const wrongLaneTimerRef = useRef(0);
  const wrongLaneLoggedRef = useRef(false);
  const redLightLoggedRef = useRef(false);
  const lastCollisionTimeRef = useRef(-10);

  // Checkpoints
  const routeCheckpointsRef = useRef<RouteCheckpoint[]>([
    { id: 0, x: 0, z: 45, radius: 6.5, passed: false },
    { id: 1, x: 0, z: 85, radius: 6.5, passed: false },
    { id: 2, x: 30, z: 100, radius: 7.0, passed: false },
    { id: 3, x: 70, z: 100, radius: 7.0, passed: false }
  ]);
  const destinationZoneRef = useRef({ x: 105, z: 100, radius: 8.0 });

  // Function to fire violation penalties
  const triggerViolation = useCallback((msg: string, pts: number) => {
    setDrivingScore(prev => Math.max(0, prev - pts));
    setActiveAlert({ message: msg, points: pts });
  }, []);

  // Clear alert timer
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  // Reset vehicle position & violations
  const resetVehicle = useCallback(() => {
    const p = physicsRef.current;
    p.x = 0;
    p.y = 0.35;
    p.z = 0;
    p.vx = 0;
    p.vz = 0;
    p.heading = 0;
    p.speed = 0;
    p.steerAngle = 0;
    p.wheelRotation = 0;
    p.distance = 0;
    p.gear = 'P';

    routeCheckpointsRef.current.forEach(cp => (cp.passed = false));
    setCurrentCheckpointIndex(0);
    setIsDestinationReached(false);
    setShowAssessmentModal(false);

    // Reset violations and score
    setDrivingScore(100);
    setActiveAlert(null);
    overspeedTimerRef.current = 0;
    overspeedPenaltyLoggedRef.current = false;
    wrongLaneTimerRef.current = 0;
    wrongLaneLoggedRef.current = false;
    redLightLoggedRef.current = false;

    // Reset Phase 5 telemetry & counters
    telemetrySamplesRef.current = [];
    violationStatsRef.current = {
      collisions: 0,
      redLights: 0,
      wrongLanes: 0,
      overspeeds: 0,
      hardBrakes: 0,
      aggressiveAccels: 0
    };
    sessionStartTimeRef.current = performance.now();
    previousSpeedMsRef.current = 0;
    maxSpeedKmhRef.current = 0;
    setCurrentAccel(0);
    hasSavedSessionRef.current = false;
  }, []);

  // Audio lifecycle effect
  useEffect(() => {
    if (audioEnabled) {
      if (!audioEngineRef.current) {
        audioEngineRef.current = new ProceduralVehicleAudio();
        audioEngineRef.current.init();
      }
      audioEngineRef.current.setMuted(false);
    } else {
      audioEngineRef.current?.setMuted(true);
    }
    return () => {
      // safe keep
    };
  }, [audioEnabled]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        setGameState(prev => {
          if (prev === 'driving') return 'paused';
          if (prev === 'paused') return 'driving';
          return prev;
        });
        return;
      }

      if (key === 'c') {
        setCameraMode(prev => (prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'hood' : 'chase'));
        return;
      }

      if (key === 'h') {
        setHeadlightsOn(prev => !prev);
        return;
      }

      if (key === 'm') {
        setAudioEnabled(prev => !prev);
        return;
      }

      if (key === 'b') {
        audioEngineRef.current?.playHorn();
        return;
      }

      if (key === 'q') {
        blinkStateRef.current.left = !blinkStateRef.current.left;
        if (blinkStateRef.current.left) blinkStateRef.current.right = false;
        return;
      }

      if (key === 'e') {
        blinkStateRef.current.right = !blinkStateRef.current.right;
        if (blinkStateRef.current.right) blinkStateRef.current.left = false;
        return;
      }

      if (key === 'w' || e.key === 'ArrowUp') keysRef.current.forward = true;
      if (key === 's' || e.key === 'ArrowDown') keysRef.current.backward = true;
      if (key === 'a' || e.key === 'ArrowLeft') keysRef.current.left = true;
      if (key === 'd' || e.key === 'ArrowRight') keysRef.current.right = true;
      if (e.code === 'Space') keysRef.current.handbrake = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') keysRef.current.forward = false;
      if (key === 's' || e.key === 'ArrowDown') keysRef.current.backward = false;
      if (key === 'a' || e.key === 'ArrowLeft') keysRef.current.left = false;
      if (key === 'd' || e.key === 'ArrowRight') keysRef.current.right = false;
      if (e.code === 'Space') keysRef.current.handbrake = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Three.js Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x769ec2);
    scene.fog = new THREE.FogExp2(0x769ec2, 0.005);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 3, -7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    dirLight.position.set(35, 50, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const groundGeo = new THREE.PlaneGeometry(600, 600);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d6634, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Road Materials & Network
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.85, metalness: 0.15 });
    const markingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const roadWidth = 14;

    const mainAvenue = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 600), roadMat);
    mainAvenue.rotation.x = -Math.PI / 2;
    mainAvenue.position.set(0, 0.02, 0);
    mainAvenue.receiveShadow = true;
    scene.add(mainAvenue);

    const crossStreet = new THREE.Mesh(new THREE.PlaneGeometry(400, roadWidth), roadMat);
    crossStreet.rotation.x = -Math.PI / 2;
    crossStreet.position.set(0, 0.022, 100);
    crossStreet.receiveShadow = true;
    scene.add(crossStreet);

    // Center Dashes
    const dashesGroup = new THREE.Group();
    const dashLength = 4;
    const dashGap = 6;
    for (let z = -280; z <= 280; z += dashLength + dashGap) {
      if (z > 85 && z < 115) continue;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, dashLength), markingMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.03, z);
      dashesGroup.add(dash);
    }
    scene.add(dashesGroup);

    // Crosswalks
    const createCrosswalk = (posX: number, posZ: number, isVertical: boolean) => {
      const group = new THREE.Group();
      const numStripes = 8;
      const stripeGeo = isVertical ? new THREE.PlaneGeometry(0.6, 3.5) : new THREE.PlaneGeometry(3.5, 0.6);
      for (let i = -numStripes / 2; i < numStripes / 2; i++) {
        const stripe = new THREE.Mesh(stripeGeo, markingMat);
        stripe.rotation.x = -Math.PI / 2;
        if (isVertical) stripe.position.set(i * 1.4 + 0.7, 0.032, 0);
        else stripe.position.set(0, 0.032, i * 1.4 + 0.7);
        group.add(stripe);
      }
      group.position.set(posX, 0, posZ);
      return group;
    };
    scene.add(createCrosswalk(0, 89, true));
    scene.add(createCrosswalk(0, 111, true));
    scene.add(createCrosswalk(-11, 100, false));
    scene.add(createCrosswalk(11, 100, false));

    // Stop Line at Z: 85
    const stopLineSouth = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth / 2 - 0.5, 0.5), markingMat);
    stopLineSouth.rotation.x = -Math.PI / 2;
    stopLineSouth.position.set(3.2, 0.033, 85);
    scene.add(stopLineSouth);

    // Roadside barriers (for collision testing)
    const barrierGeo = new THREE.BoxGeometry(0.5, 0.8, 12);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c });
    const barrierLeft = new THREE.Mesh(barrierGeo, barrierMat);
    barrierLeft.position.set(-8.5, 0.4, 45);
    const barrierRight = new THREE.Mesh(barrierGeo, barrierMat);
    barrierRight.position.set(8.5, 0.4, 45);
    scene.add(barrierLeft, barrierRight);

    // Traffic Signal Gantry
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
    const gantryGroup = new THREE.Group();
    const poleMain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 5.5, 8), metalMat);
    poleMain.position.y = 2.75;
    const gantryArm = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.15, 0.15), metalMat);
    gantryArm.position.set(-3.5, 5.2, 0);

    const housingBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    housingBox.position.set(-3.5, 4.4, 0);

    const lensGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16);
    lensGeo.rotateX(Math.PI / 2);

    const redLens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
    redLens.position.set(0, 0.55, 0.22);
    const yellowLens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0x3a3010 }));
    yellowLens.position.set(0, 0, 0.22);
    const greenLens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
    greenLens.position.set(0, -0.55, 0.22);

    housingBox.add(redLens, yellowLens, greenLens);
    gantryGroup.add(poleMain, gantryArm, housingBox);
    gantryGroup.position.set(roadWidth / 2 + 1.5, 0, 88);
    scene.add(gantryGroup);

    // Checkpoints & Destination
    const checkpointMeshes: THREE.Group[] = [];
    const checkpointMatActive = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });

    routeCheckpointsRef.current.forEach(cp => {
      const cpGroup = new THREE.Group();
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.12, 8, 24), checkpointMatActive.clone());
      ringMesh.position.y = 3.5;
      const groundCircle = new THREE.Mesh(new THREE.RingGeometry(0.5, 3.5, 24), checkpointMatActive.clone());
      groundCircle.rotation.x = -Math.PI / 2;
      groundCircle.position.y = 0.04;
      cpGroup.add(ringMesh, groundCircle);
      cpGroup.position.set(cp.x, 0, cp.z);
      scene.add(cpGroup);
      checkpointMeshes.push(cpGroup);
    });

    const destGroup = new THREE.Group();
    const destZone = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.5 }));
    destZone.rotation.x = -Math.PI / 2;
    destZone.position.set(0, 0.04, 0);
    destGroup.add(destZone);
    destGroup.position.set(destinationZoneRef.current.x, 0, destinationZoneRef.current.z);
    scene.add(destGroup);

    // Phase 4: Rain Particles System
    const rainCount = 1200;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      rainPositions[i * 3 + 1] = Math.random() * 25;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.16, transparent: true, opacity: 0.65 });
    const rainParticles = new THREE.Points(rainGeo, rainMat);
    scene.add(rainParticles);

    // Phase 4: Street Lamps for Night Lighting
    const streetLampGroup = new THREE.Group();
    for (let z = -60; z <= 180; z += 40) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), metalMat);
      lamp.position.set(8.2, 2.25, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), metalMat);
      arm.position.set(-0.5, 2.2, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffedd5 }));
      bulb.position.set(-1.0, 2.1, 0);
      lamp.add(arm, bulb);
      const pointLight = new THREE.PointLight(0xffedd5, 0.9, 16, 1.5);
      pointLight.position.set(-1.0, 2.0, 0);
      lamp.add(pointLight);
      streetLampGroup.add(lamp);
    }
    scene.add(streetLampGroup);

    // Phase 4: AI Traffic Vehicle (Navigating cross street Z: 100)
    const trafficCarGroup = new THREE.Group();
    const trafficChassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.8), new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.6, roughness: 0.3 }));
    trafficChassis.position.y = 0.55;
    const trafficCabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.0), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 }));
    trafficCabin.position.set(0, 0.95, -0.1);
    trafficCarGroup.add(trafficChassis, trafficCabin);
    trafficCarGroup.position.set(-50, 0, 100);
    trafficCarGroup.rotation.y = Math.PI / 2;
    scene.add(trafficCarGroup);

    // Phase 4: Crosswalk Pedestrian (Crossing Z: 89)
    const pedGroup = new THREE.Group();
    const pedBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    pedBody.position.y = 0.75;
    const pedHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfde68a }));
    pedHead.position.y = 1.45;
    pedGroup.add(pedBody, pedHead);
    pedGroup.position.set(-5.5, 0, 89);
    scene.add(pedGroup);

    // Car Root
    const carRoot = new THREE.Group();
    scene.add(carRoot);

    const carBodyGroup = new THREE.Group();
    carRoot.add(carBodyGroup);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.25 }));
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    carBodyGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 2.2), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.1 }));
    cabin.position.set(0, 0.98, -0.2);
    cabin.castShadow = true;
    carBodyGroup.add(cabin);

    // Phase 7: Cockpit Interior Steering Wheel
    const cockpitSteeringWheel = new THREE.Group();
    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.02, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    const wheelSpokeH = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    const wheelSpokeV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.19, 0.02), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    wheelSpokeV.position.y = -0.08;
    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    centerCap.rotation.x = Math.PI / 2;
    cockpitSteeringWheel.add(wheelRim, wheelSpokeH, wheelSpokeV, centerCap);
    cockpitSteeringWheel.position.set(-0.35, 0.88, 0.25);
    cockpitSteeringWheel.rotation.x = THREE.MathUtils.degToRad(-20);
    carBodyGroup.add(cockpitSteeringWheel);

    // Phase 7: Emissive Rear Brake Lights
    const brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0x440000,
      emissive: new THREE.Color(0x220000),
      emissiveIntensity: 0.2,
      roughness: 0.2
    });
    const brakeLightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), brakeLightMat);
    brakeLightLeft.position.set(-0.65, 0.6, -2.12);
    const brakeLightRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), brakeLightMat);
    brakeLightRight.position.set(0.65, 0.6, -2.12);
    carBodyGroup.add(brakeLightLeft, brakeLightRight);

    // Phase 7: Turn Signal Indicators (Amber corner markers)
    const blinkerMatLeft = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      roughness: 0.3
    });
    const blinkerMatRight = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      roughness: 0.3
    });

    const blinkerFL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), blinkerMatLeft);
    blinkerFL.position.set(-0.82, 0.58, 2.12);
    const blinkerRL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), blinkerMatLeft);
    blinkerRL.position.set(-0.82, 0.58, -2.12);

    const blinkerFR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), blinkerMatRight);
    blinkerFR.position.set(0.82, 0.58, 2.12);
    const blinkerRR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), blinkerMatRight);
    blinkerRR.position.set(0.82, 0.58, -2.12);

    carBodyGroup.add(blinkerFL, blinkerRL, blinkerFR, blinkerRR);

    // Phase 4: Headlights on Player Car
    const headlightLeft = new THREE.SpotLight(0xfff8e7, 0, 45, Math.PI / 7, 0.4, 1.2);
    headlightLeft.position.set(-0.65, 0.6, 2.0);
    const headlightLeftTarget = new THREE.Object3D();
    headlightLeftTarget.position.set(-0.65, 0.2, 25);
    carRoot.add(headlightLeft, headlightLeftTarget);
    headlightLeft.target = headlightLeftTarget;

    const headlightRight = new THREE.SpotLight(0xfff8e7, 0, 45, Math.PI / 7, 0.4, 1.2);
    headlightRight.position.set(0.65, 0.6, 2.0);
    const headlightRightTarget = new THREE.Object3D();
    headlightRightTarget.position.set(0.65, 0.2, 25);
    carRoot.add(headlightRight, headlightRightTarget);
    headlightRight.target = headlightRightTarget;

    const wheelRadius = 0.35;
    const wheelWidth = 0.25;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });

    const createWheel = () => {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      g.add(tire, rim);
      return g;
    };

    const wheelFL = createWheel();
    const wheelFR = createWheel();
    const wheelRL = createWheel();
    const wheelRR = createWheel();

    const wheelOffsets = {
      fl: new THREE.Vector3(-0.92, 0.35, 1.3),
      fr: new THREE.Vector3(0.92, 0.35, 1.3),
      rl: new THREE.Vector3(-0.92, 0.35, -1.3),
      rr: new THREE.Vector3(0.92, 0.35, -1.3)
    };
    carRoot.add(wheelFL, wheelFR, wheelRL, wheelRR);

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let menuOrbitAngle = 0;
    let trafficTimer = 0;
    let trafficCarX = -50;
    let pedX = -5.5;
    let pedDir = 1;
    const currentCamPos = new THREE.Vector3(0, 3, -7);

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const keys = keysRef.current;
      const p = physicsRef.current;

      // 1. Traffic Light Cycle (Green: 12s, Yellow: 3.5s, Red: 10s)
      trafficTimer += dt;
      const cycleTotal = 25.5;
      const tInCycle = trafficTimer % cycleTotal;

      if (tInCycle < 12.0) {
        currentSignalColorRef.current = 'green';
        (redLens.material as THREE.MeshBasicMaterial).color.setHex(0x3a1010);
        (yellowLens.material as THREE.MeshBasicMaterial).color.setHex(0x3a3010);
        (greenLens.material as THREE.MeshBasicMaterial).color.setHex(0x00ff66);
      } else if (tInCycle < 15.5) {
        currentSignalColorRef.current = 'yellow';
        (redLens.material as THREE.MeshBasicMaterial).color.setHex(0x3a1010);
        (yellowLens.material as THREE.MeshBasicMaterial).color.setHex(0xfbbf24);
        (greenLens.material as THREE.MeshBasicMaterial).color.setHex(0x083314);
      } else {
        currentSignalColorRef.current = 'red';
        (redLens.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
        (yellowLens.material as THREE.MeshBasicMaterial).color.setHex(0x3a3010);
        (greenLens.material as THREE.MeshBasicMaterial).color.setHex(0x083314);
      }

      // Phase 4: Apply Scenario Lighting & Atmospheric Conditions
      const currentScen = scenarioRef.current;
      const isNight = currentScen === 'night';
      const isRain = currentScen === 'rain';

      if (isNight) {
        (scene.background as THREE.Color)?.setHex(0x0a0f1d);
        if (scene.fog) scene.fog.color.setHex(0x0a0f1d);
        dirLight.intensity = 0.12;
        dirLight.color.setHex(0x38bdf8);
        ambientLight.intensity = 0.2;
      } else if (isRain) {
        (scene.background as THREE.Color)?.setHex(0x3e4854);
        if (scene.fog) scene.fog.color.setHex(0x3e4854);
        dirLight.intensity = 0.55;
        dirLight.color.setHex(0x94a3b8);
        ambientLight.intensity = 0.45;
      } else if (currentScen === 'highway') {
        (scene.background as THREE.Color)?.setHex(0x84b2df);
        if (scene.fog) scene.fog.color.setHex(0x84b2df);
        dirLight.intensity = 1.95;
        dirLight.color.setHex(0xfffaed);
        ambientLight.intensity = 0.8;
      } else {
        (scene.background as THREE.Color)?.setHex(0x769ec2);
        if (scene.fog) scene.fog.color.setHex(0x769ec2);
        dirLight.intensity = 1.6;
        dirLight.color.setHex(0xfffaed);
        ambientLight.intensity = 0.7;
      }

      streetLampGroup.visible = isNight;

      // Update Headlights (Active if toggled ON or in Night mode)
      const headlightsActive = headlightsRef.current || isNight;
      headlightLeft.intensity = headlightsActive ? 4.8 : 0;
      headlightRight.intensity = headlightsActive ? 4.8 : 0;

      // Update Rain Particles
      if (isRain) {
        rainParticles.visible = true;
        const rainPosArr = rainGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < rainCount; i++) {
          rainPosArr[i * 3 + 1] -= 32 * dt;
          if (rainPosArr[i * 3 + 1] < 0) {
            rainPosArr[i * 3 + 1] = 22;
            rainPosArr[i * 3] = p.x + (Math.random() - 0.5) * 50;
            rainPosArr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 50;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
      } else {
        rainParticles.visible = false;
      }

      // Update AI Traffic Vehicle along Cross Street Z: 100
      trafficCarX += 7.5 * dt;
      if (trafficCarX > 60) trafficCarX = -60;
      trafficCarGroup.position.set(trafficCarX, 0, 100);

      // Update Crosswalk Pedestrian along Z: 89
      pedX += pedDir * 1.35 * dt;
      if (pedX > 5.5) { pedX = 5.5; pedDir = -1; }
      else if (pedX < -5.5) { pedX = -5.5; pedDir = 1; }
      pedGroup.position.set(pedX, 0, 89);

      // 2. Physics Simulation
      if (gameState === 'driving') {
        const targetSteer = keys.left ? p.maxSteerAngle : keys.right ? -p.maxSteerAngle : 0;
        p.steerAngle = THREE.MathUtils.lerp(p.steerAngle, targetSteer, dt * (isRain ? 6.5 : 10.0));

        // Wet asphalt friction curve reduction (Phase 4: WeatherManager)
        p.friction = isRain ? 0.965 : 0.985;

        const forwardThrottle = keys.forward ? 1 : 0;
        const reverseThrottle = keys.backward ? 1 : 0;
        const isHandbraking = keys.handbrake;

        if (isHandbraking) {
          p.speed = THREE.MathUtils.lerp(p.speed, 0, dt * 6.0);
          p.gear = 'P';
        } else if (forwardThrottle > 0) {
          if (p.speed < -0.5) {
            p.speed += p.brakeForce * dt;
          } else {
            p.speed += p.acceleration * dt;
            if (p.speed > p.maxSpeedForward) p.speed = p.maxSpeedForward;
            p.gear = 'D';
          }
        } else if (reverseThrottle > 0) {
          if (p.speed > 0.5) {
            p.speed -= p.brakeForce * dt;
          } else {
            p.speed -= p.acceleration * 0.55 * dt;
            if (p.speed < -p.maxSpeedReverse) p.speed = -p.maxSpeedReverse;
            p.gear = 'R';
          }
        } else {
          p.speed *= Math.pow(p.friction, dt * 60);
          if (Math.abs(p.speed) < 0.15) {
            p.speed = 0;
            p.gear = 'N';
          }
        }

        if (Math.abs(p.speed) > 0.05) {
          const wheelbase = 2.6;
          const turnRate = (p.speed / wheelbase) * Math.sin(p.steerAngle);
          p.heading += turnRate * dt;
        }

        p.vx = Math.sin(p.heading) * p.speed;
        p.vz = Math.cos(p.heading) * p.speed;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.distance += Math.abs(p.speed) * dt;

        const angularVelocity = p.speed / wheelRadius;
        p.wheelRotation += angularVelocity * dt;

        const currentSpeedKmh = Math.abs(p.speed) * 3.6;
        if (currentSpeedKmh > maxSpeedKmhRef.current) {
          maxSpeedKmhRef.current = currentSpeedKmh;
        }

        // ==========================================
        // PHASE 5: KINEMATIC ACCELERATION & TELEMETRY
        // ==========================================
        const speedMs = Math.abs(p.speed);
        const accelMs2 = dt > 0 ? (speedMs - previousSpeedMsRef.current) / dt : 0;
        previousSpeedMsRef.current = speedMs;
        setCurrentAccel(Math.round(accelMs2 * 10) / 10);

        // G-1. Hard Braking Detection (Deceleration <= -6.5 m/s² above 15 km/h)
        if (accelMs2 <= -6.5 && currentSpeedKmh > 15 && (time - lastHardBrakeTimeRef.current) > 3000) {
          lastHardBrakeTimeRef.current = time;
          violationStatsRef.current.hardBrakes++;
          triggerViolation(`Hard Braking: ${accelMs2.toFixed(1)} m/s² deceleration`, 3);
        }

        // G-2. Aggressive Acceleration Detection (Surge >= 4.8 m/s²)
        if (accelMs2 >= 4.8 && currentSpeedKmh < 50 && (time - lastAggressiveAccelTimeRef.current) > 4000) {
          lastAggressiveAccelTimeRef.current = time;
          violationStatsRef.current.aggressiveAccels++;
          setActiveAlert({ message: `Aggressive Acceleration: +${accelMs2.toFixed(1)} m/s² surge`, points: 0 });
        }

        // G-3. Continuous 10 Hz Telemetry Recording
        const activeSpeedLimit = currentScen === 'highway' ? 80 : 50;
        telemetrySampleTimerRef.current += dt;
        if (telemetrySampleTimerRef.current >= 0.1) {
          telemetrySampleTimerRef.current = 0;
          telemetrySamplesRef.current.push({
            timestamp: Math.round(((time - sessionStartTimeRef.current) / 1000) * 100) / 100,
            speedKmh: Math.round(currentSpeedKmh * 10) / 10,
            accelerationMs2: Math.round(accelMs2 * 100) / 100,
            throttle: forwardThrottle > 0 ? 1 : 0,
            brake: reverseThrottle > 0 || isHandbraking ? 1 : 0,
            steerAngleDeg: Math.round(THREE.MathUtils.radToDeg(p.steerAngle)),
            posX: Math.round(p.x * 10) / 10,
            posY: Math.round(p.y * 10) / 10,
            posZ: Math.round(p.z * 10) / 10,
            speedLimitKmh: activeSpeedLimit,
            isHardBraking: accelMs2 <= -6.5,
            isAggressiveAccel: accelMs2 >= 4.8
          });
        }

        // ==========================================
        // PHASE 3 & 4 REAL-TIME VIOLATION SENSORS
        // ==========================================
        // A. Overspeed Violation (Highway: 80 km/h, City/Rain/Night: 50 km/h)
        if (p.z < 85 && currentSpeedKmh > (activeSpeedLimit + 3)) {
          overspeedTimerRef.current += dt;
          if (overspeedTimerRef.current >= 2.0 && !overspeedPenaltyLoggedRef.current) {
            overspeedPenaltyLoggedRef.current = true;
            violationStatsRef.current.overspeeds++;
            triggerViolation(`Overspeed: ${Math.round(currentSpeedKmh)} km/h in ${activeSpeedLimit} km/h zone`, 5);
          }
        } else {
          overspeedTimerRef.current = Math.max(0, overspeedTimerRef.current - dt * 2.0);
          if (overspeedTimerRef.current <= 0.1) overspeedPenaltyLoggedRef.current = false;
        }

        // B. Red Light Violation (Crossing stop line at Z: 85-88 while light is Red)
        if (currentSignalColorRef.current === 'red' && p.z >= 85 && p.z <= 88 && !redLightLoggedRef.current) {
          redLightLoggedRef.current = true;
          violationStatsRef.current.redLights++;
          triggerViolation('Red Light Signal Violation: Crossed on Red', 15);
        }
        if (p.z > 115 || p.z < 80) {
          redLightLoggedRef.current = false;
        }

        // C. Wrong Lane Driving (Sustained in oncoming lane X < -1.5)
        if (p.z < 85 && p.x < -1.5 && currentSpeedKmh > 8) {
          wrongLaneTimerRef.current += dt;
          if (wrongLaneTimerRef.current >= 1.5 && !wrongLaneLoggedRef.current) {
            wrongLaneLoggedRef.current = true;
            violationStatsRef.current.wrongLanes++;
            triggerViolation('Wrong Lane: Driving in Oncoming Traffic Lane', 10);
          }
        } else {
          wrongLaneTimerRef.current = Math.max(0, wrongLaneTimerRef.current - dt * 2.0);
          if (wrongLaneTimerRef.current <= 0.1) wrongLaneLoggedRef.current = false;
        }

        // D. Collision with roadside barriers (|X| > 8.0)
        if (Math.abs(p.x) > 8.2 && time - lastCollisionTimeRef.current > 2500) {
          lastCollisionTimeRef.current = time;
          p.speed *= -0.3; // bounce
          violationStatsRef.current.collisions++;
          triggerViolation('Collision with Roadside Barrier', 20);
          audioEngineRef.current?.playCrash(1.0);
        }

        // E. Phase 4: Collision with AI Traffic Car (at cross-street Z: 100)
        const distToTrafficCar = Math.hypot(p.x - trafficCarX, p.z - 100);
        if (distToTrafficCar < 3.2 && time - lastCollisionTimeRef.current > 2500) {
          lastCollisionTimeRef.current = time;
          p.speed *= -0.4;
          violationStatsRef.current.collisions++;
          triggerViolation('Collision with Traffic Vehicle', 20);
          audioEngineRef.current?.playCrash(1.2);
        }

        // F. Phase 4: Collision with Crosswalk Pedestrian (at crosswalk Z: 89)
        const distToPed = Math.hypot(p.x - pedX, p.z - 89);
        if (distToPed < 1.6 && time - lastCollisionTimeRef.current > 2500) {
          lastCollisionTimeRef.current = time;
          p.speed *= 0.5;
          violationStatsRef.current.collisions++;
          triggerViolation('Pedestrian Impact at Crosswalk', 20);
          audioEngineRef.current?.playCrash(0.8);
        }

        // Route Checkpoint Progression
        const checkpoints = routeCheckpointsRef.current;
        let activeIdx = checkpoints.findIndex(cp => !cp.passed);

        if (activeIdx !== -1) {
          const activeCp = checkpoints[activeIdx];
          const dist = Math.hypot(p.x - activeCp.x, p.z - activeCp.z);
          setDistanceToNextTarget(Math.round(dist));

          if (dist < activeCp.radius) {
            activeCp.passed = true;
            const group = checkpointMeshes[activeIdx];
            if (group) {
              group.children.forEach(child => {
                if ((child as THREE.Mesh).material) {
                  ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
                }
              });
            }
            const nextIdx = checkpoints.findIndex(cp => !cp.passed);
            setCurrentCheckpointIndex(nextIdx === -1 ? checkpoints.length : nextIdx);
          }
        } else {
          const dest = destinationZoneRef.current;
          const distDest = Math.hypot(p.x - dest.x, p.z - dest.z);
          setDistanceToNextTarget(Math.round(distDest));
          if (distDest < dest.radius) {
            setIsDestinationReached(true);
            setShowAssessmentModal(true);
          }
        }
      }

      // Synchronize Car Visuals
      carRoot.position.set(p.x, p.y, p.z);
      carRoot.rotation.y = p.heading;

      wheelFL.position.copy(wheelOffsets.fl);
      wheelFL.rotation.set(p.wheelRotation, p.steerAngle, 0, 'YXZ');
      wheelFR.position.copy(wheelOffsets.fr);
      wheelFR.rotation.set(p.wheelRotation, p.steerAngle, 0, 'YXZ');
      wheelRL.position.copy(wheelOffsets.rl);
      wheelRL.rotation.set(p.wheelRotation, 0, 0);
      wheelRR.position.copy(wheelOffsets.rr);
      wheelRR.rotation.set(p.wheelRotation, 0, 0);

      // Phase 7: Cockpit steering column animation
      cockpitSteeringWheel.rotation.z = -p.steerAngle * 4.2;

      // Phase 7: Emissive brake lights modulation
      const isCarBraking = keys.backward || keys.handbrake;
      if (isCarBraking) {
        brakeLightMat.emissive.setHex(0xff1111);
        brakeLightMat.emissiveIntensity = 3.2;
      } else {
        brakeLightMat.emissive.setHex(0x220000);
        brakeLightMat.emissiveIntensity = 0.2;
      }

      // Phase 7: Turn signal blinker timing
      if (blinkStateRef.current.left || blinkStateRef.current.right) {
        blinkStateRef.current.timer += dt;
        if (blinkStateRef.current.timer >= 0.45) {
          blinkStateRef.current.timer = 0;
          blinkStateRef.current.on = !blinkStateRef.current.on;
          if (audioEnabled) {
            audioEngineRef.current?.playBlinkerClick();
          }
        }
      } else {
        blinkStateRef.current.timer = 0;
        blinkStateRef.current.on = false;
      }

      const isBlinkingOn = blinkStateRef.current.on;
      if (blinkStateRef.current.left && isBlinkingOn) {
        blinkerMatLeft.emissive.setHex(0xf59e0b);
        blinkerMatLeft.emissiveIntensity = 3.2;
      } else {
        blinkerMatLeft.emissiveIntensity = 0.0;
      }

      if (blinkStateRef.current.right && isBlinkingOn) {
        blinkerMatRight.emissive.setHex(0xf59e0b);
        blinkerMatRight.emissiveIntensity = 3.2;
      } else {
        blinkerMatRight.emissiveIntensity = 0.0;
      }

      // Phase 7: Procedural dynamic vehicle audio engine updates
      if (audioEnabled && gameState === 'driving') {
        const currentSpeedKmh = Math.abs(p.speed) * 3.6;
        const isTireSkidding = (keys.handbrake && currentSpeedKmh > 12) || (Math.abs(p.steerAngle) > 0.38 && currentSpeedKmh > 35);
        audioEngineRef.current?.update(currentSpeedKmh, keys.forward ? 1 : 0, isCarBraking, isTireSkidding);
      }

      // Camera System
      if (gameState === 'menu') {
        menuOrbitAngle += dt * 0.4;
        const orbitDist = 8;
        camera.position.set(p.x + Math.sin(menuOrbitAngle) * orbitDist, 2.8, p.z + Math.cos(menuOrbitAngle) * orbitDist);
        camera.lookAt(p.x, 1.0, p.z);
      } else {
        const carForward = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
        let desiredCamPos: THREE.Vector3;
        let lookTarget: THREE.Vector3;

        if (cameraMode === 'chase') {
          const distance = 6.5;
          const height = 2.7;
          desiredCamPos = carRoot.position.clone().sub(carForward.clone().multiplyScalar(distance)).add(new THREE.Vector3(0, height, 0));
          lookTarget = carRoot.position.clone().add(new THREE.Vector3(0, 1.1, 0));
          currentCamPos.lerp(desiredCamPos, Math.min(dt * 7.5, 1.0));
          camera.position.copy(currentCamPos);
          camera.lookAt(lookTarget);
        } else if (cameraMode === 'cockpit') {
          const driverEyeOffset = new THREE.Vector3(-0.35, 1.15, 0.15).applyEuler(carRoot.rotation);
          desiredCamPos = carRoot.position.clone().add(driverEyeOffset);
          lookTarget = desiredCamPos.clone().add(carForward.clone().multiplyScalar(20));
          camera.position.copy(desiredCamPos);
          camera.lookAt(lookTarget);
        } else {
          const hoodOffset = new THREE.Vector3(0, 0.88, 1.8).applyEuler(carRoot.rotation);
          desiredCamPos = carRoot.position.clone().add(hoodOffset);
          lookTarget = desiredCamPos.clone().add(carForward.clone().multiplyScalar(20));
          camera.position.copy(desiredCamPos);
          camera.lookAt(lookTarget);
        }
      }

      dirLight.position.set(p.x + 35, 50, p.z - 30);
      dirLight.target.position.set(p.x, 0, p.z);

      // Telemetry Update
      const speedKmh = Math.abs(p.speed) * 3.6;
      const rpm = Math.min(7500, Math.max(800, 800 + (speedKmh / 130) * 5500));
      const updatedTelemetry: VehicleTelemetry = {
        speedKmh: Math.round(speedKmh),
        engineRpm: Math.round(rpm),
        currentGear: p.gear,
        steerAngle: Math.round(THREE.MathUtils.radToDeg(p.steerAngle)),
        motorTorque: keys.forward ? 1600 : keys.backward ? 800 : 0,
        brakeTorque: keys.handbrake ? 6500 : keys.backward && p.speed > 0.5 ? 3200 : 0,
        isHandbraking: keys.handbrake,
        distanceTraveled: Math.round(p.distance)
      };

      setTelemetry(updatedTelemetry);
      if (onTelemetryUpdate) onTelemetryUpdate(updatedTelemetry);

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [gameState, cameraMode, onTelemetryUpdate, triggerViolation]);

  // Score tier color helper
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 75) return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  // Phase 5: Explainable Natural Language Driver Assessment Generator
  const generateAssessment = useCallback(() => {
    const score = drivingScore;
    let classification: 'Excellent' | 'Good' | 'Needs Improvement' | 'Unsafe Driving';
    if (score >= 90) classification = 'Excellent';
    else if (score >= 75) classification = 'Good';
    else if (score >= 60) classification = 'Needs Improvement';
    else classification = 'Unsafe Driving';

    const stats = violationStatsRef.current;
    const strengths: string[] = [];
    const infractions: string[] = [];
    const recommendations: string[] = [];

    // 1. Strengths
    if (stats.collisions === 0)
      strengths.push('Zero collisions: Maintained safe clearance from barriers and traffic vehicles.');
    if (stats.redLights === 0)
      strengths.push('Flawless intersection discipline: Stopped and waited for all red signal phases.');
    if (stats.wrongLanes === 0)
      strengths.push('Consistent lane adherence: Stayed centered in correct right-side driving lane.');
    if (stats.overspeeds === 0)
      strengths.push('Strict speed regulation: Stayed compliant within posted zone speed limits.');
    if (stats.hardBrakes <= 1)
      strengths.push('Smooth brake pedal control: No sudden high-G deceleration jerk.');

    // 2. Infractions & Mistakes
    if (stats.collisions > 0)
      infractions.push(`Involved in ${stats.collisions} barrier or traffic vehicle collision event(s).`);
    if (stats.redLights > 0)
      infractions.push(`Crossed ${stats.redLights} intersection stop-line(s) during active Red signal.`);
    if (stats.wrongLanes > 0)
      infractions.push(`Drifted into oncoming traffic lane ${stats.wrongLanes} time(s).`);
    if (stats.overspeeds > 0)
      infractions.push(`Exceeded zone speed limit on ${stats.overspeeds} occasion(s).`);
    if (stats.hardBrakes > 1)
      infractions.push(`Braked sharply ${stats.hardBrakes} times (deceleration exceeding -6.5 m/s²).`);

    // 3. Actionable Recommendations
    if (stats.overspeeds > 0)
      recommendations.push('Monitor the speedometer HUD more frequently and observe roadside regulatory speed limit signs.');
    if (stats.hardBrakes > 0)
      recommendations.push('Start reducing speed earlier when approaching intersections and crosswalks rather than slamming on brakes.');
    if (stats.redLights > 0)
      recommendations.push('Anticipate yellow signal transitions and brake smoothly to a stop before the stop-line.');
    if (stats.wrongLanes > 0)
      recommendations.push('Keep vehicle aligned with right-lane center dash markings, especially when steering into turns.');
    if (recommendations.length === 0)
      recommendations.push('Outstanding performance! Proceed to Rain and Night training scenarios to test low-grip handling.');

    // 4. Synthesized Natural Language Summary
    let summaryParagraph = `Driver achieved a score of ${score}/100 (${classification}). `;
    if (classification === 'Excellent') {
      summaryParagraph += 'Demonstrated exemplary vehicle control, compliant speed discipline, and safe road etiquette.';
    } else if (classification === 'Good') {
      if (stats.overspeeds > 0) {
        summaryParagraph += `Your overall lane control was good, but you exceeded the speed limit ${stats.overspeeds} times.`;
      } else if (stats.hardBrakes > 0) {
        summaryParagraph += `You braked sharply ${stats.hardBrakes} times. Start reducing speed earlier before intersections.`;
      } else {
        summaryParagraph += 'Driving was generally safe and competent with minor infractions noted.';
      }
    } else if (classification === 'Needs Improvement') {
      summaryParagraph += 'Inconsistent vehicle regulation detected. Excessive speed variations or multiple lane boundary breaches require practice.';
    } else {
      summaryParagraph += 'Significant unsafe driving behaviors detected including collisions or red light violations. Remedial training strongly recommended.';
    }

    const durationSec = Math.max(1, Math.round((performance.now() - sessionStartTimeRef.current) / 1000));
    const samples = telemetrySamplesRef.current;
    const avgSpeed = samples.length > 0
      ? Math.round(samples.reduce((sum, s) => sum + s.speedKmh, 0) / samples.length)
      : telemetry.speedKmh;

    return {
      score,
      classification,
      summaryParagraph,
      strengths,
      infractions,
      recommendations,
      durationSec,
      avgSpeed,
      maxSpeed: Math.round(maxSpeedKmhRef.current),
      stats
    };
  }, [drivingScore, telemetry.speedKmh]);

  // Phase 5: Export Telemetry CSV
  const downloadTelemetryCsv = () => {
    const records = telemetrySamplesRef.current;
    if (records.length === 0) {
      alert('No telemetry samples recorded yet. Drive around first!');
      return;
    }
    let csv = 'Timestamp_Sec,Speed_Kmh,Accel_Ms2,Throttle,Brake,Steer_Deg,PosX,PosY,PosZ,SpeedLimit_Kmh,HardBraking,AggressiveAccel\n';
    records.forEach(r => {
      csv += `${r.timestamp.toFixed(2)},${r.speedKmh.toFixed(1)},${r.accelerationMs2.toFixed(2)},${r.throttle.toFixed(2)},${r.brake.toFixed(2)},${r.steerAngleDeg.toFixed(1)},${r.posX.toFixed(1)},${r.posY.toFixed(1)},${r.posZ.toFixed(1)},${r.speedLimitKmh},${r.isHardBraking},${r.isAggressiveAccel}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `driving_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const assessmentReport = generateAssessment();

  // Phase 6: Auto-save session record to persistent storage on assessment modal trigger
  useEffect(() => {
    if (showAssessmentModal && !hasSavedSessionRef.current) {
      hasSavedSessionRef.current = true;
      try {
        const activeDriverId = localStorage.getItem('cds_active_profile_id') || 'DRV-101';
        const scenarioTitles: Record<string, string> = {
          city: 'Standard City',
          highway: 'Highway Express',
          rain: 'Heavy Rain',
          night: 'Midnight City'
        };
        const scenarioName = scenarioTitles[selectedScenario] || 'Standard City';
        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
        const newSessionId = `SESS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        const report = generateAssessment();
        const newRecord: DrivingSessionData = {
          sessionId: newSessionId,
          driverId: activeDriverId,
          scenarioName: scenarioName,
          startTime: dateStr,
          endTime: dateStr,
          durationSeconds: report.durationSec,
          averageSpeedKmh: report.avgSpeed,
          maximumSpeedKmh: report.maxSpeed,
          collisionCount: report.stats.collisions,
          overspeedEvents: report.stats.overspeeds,
          redLightViolations: report.stats.redLights,
          laneViolations: report.stats.wrongLanes,
          hardBrakingEvents: report.stats.hardBrakes,
          missedCheckpoints: 0,
          finalScore: report.score,
          classification: report.classification,
          feedbackNotes: [
            report.summaryParagraph,
            ...(report.strengths.slice(0, 2)),
            ...(report.infractions.slice(0, 2))
          ]
        };

        const existingSessionsJson = localStorage.getItem('cds_driving_sessions');
        const existingSessions: DrivingSessionData[] = existingSessionsJson ? JSON.parse(existingSessionsJson) : [];
        existingSessions.unshift(newRecord);
        localStorage.setItem('cds_driving_sessions', JSON.stringify(existingSessions.slice(0, 50)));

        const profilesJson = localStorage.getItem('cds_driver_profiles');
        if (profilesJson) {
          const profiles: DriverProfile[] = JSON.parse(profilesJson);
          const match = profiles.find(p => p.id === activeDriverId);
          if (match) {
            match.totalSessions += 1;
            match.totalDistanceKm += (telemetry.distanceTraveled / 1000);
            match.totalDriveTimeMinutes += (report.durationSec / 60);
            match.averageScore = Math.round(((match.averageScore * (match.totalSessions - 1)) + report.score) / match.totalSessions);
            if (report.score > match.bestScore) match.bestScore = report.score;
            localStorage.setItem('cds_driver_profiles', JSON.stringify(profiles));
          }
        }
      } catch (e) {
        console.warn('[ThreeCanvas] Session persistence notice:', e);
      }
    }
  }, [showAssessmentModal, selectedScenario, generateAssessment, telemetry.distanceTraveled]);

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP BAR / CAMERA & STATUS OVERLAY */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
        {/* Scenario Switcher Pills & Headlights Button */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/70 pointer-events-auto shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5">Scenario:</span>
          {(['city', 'highway', 'rain', 'night'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSelectedScenario(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all flex items-center gap-1 ${
                selectedScenario === s
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {s === 'city' && <Sun className="w-3 h-3 text-amber-400" />}
              {s === 'highway' && <Compass className="w-3 h-3 text-sky-400" />}
              {s === 'rain' && <CloudRain className="w-3 h-3 text-cyan-400" />}
              {s === 'night' && <Moon className="w-3 h-3 text-indigo-400" />}
              <span>{s}</span>
            </button>
          ))}

          <div className="w-[1px] h-5 bg-slate-700/80 mx-1" />

          <button
            onClick={() => setHeadlightsOn(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              headlightsOn || selectedScenario === 'night'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Headlights [H]"
          >
            <Lightbulb className="w-3 h-3" />
            <span>[H] Lights</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {gameState === 'driving' && (
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg border border-emerald-400/40 text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
              title="Generate Driver Assessment Report & Feedback"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Assess Drive</span>
            </button>
          )}

          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700/80 text-xs font-semibold shadow-lg transition-all"
              title="Open Driver Dashboard & Student Roster"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Dashboard</span>
            </button>
          )}

          <button
            onClick={() => setCameraMode(prev => (prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'hood' : 'chase'))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg border border-blue-400/40 text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            title="Cycle Camera View (or press 'C' key)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="capitalize">
              [C] {cameraMode === 'chase' ? '3rd-Person Chase' : cameraMode === 'cockpit' ? '1st-Person Cockpit' : 'Dashboard Hood'}
            </span>
          </button>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              audioEnabled
                ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900/85 hover:bg-slate-800 text-slate-400 border-slate-700/60'
            }`}
            title="Toggle Procedural Engine Audio & SFX [M]"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">[M] Audio</span>
          </button>

          {gameState === 'driving' && (
            <button
              onClick={() => setGameState('paused')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/40 text-xs font-medium transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause (Esc)</span>
            </button>
          )}

          <button
            onClick={resetVehicle}
            className="p-1.5 bg-slate-900/85 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/60 transition-colors"
            title="Reset Vehicle & Score"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* POPUP ALERT BANNER (TOP CENTER) */}
      {activeAlert && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-bounce">
          <div className="flex items-center gap-2.5 px-5 py-2.5 bg-rose-950/95 border-2 border-rose-500 text-white rounded-xl shadow-2xl shadow-rose-950/80 backdrop-blur-md">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-rose-200">
                VIOLATION PENALTY (-{activeAlert.points} PTS)
              </span>
              <span className="text-[11px] font-medium text-slate-200">
                {activeAlert.message}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN MENU SCREEN */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fadeIn z-30">
          <div className="max-w-lg w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-7 shadow-2xl space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold tracking-wider text-sky-400 uppercase">Product Development Laboratory</span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Car Driving Simulator</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Phase 4: Training Scenarios (City, Highway, Rain, Night), Dynamic Weather, Wet Road Grip Loss, AI Traffic &amp; Pedestrian Hazards.
              </p>
            </div>

            {/* Scenario Selection Cards in Main Menu */}
            <div className="space-y-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select Training Scenario:</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'city', title: 'City Driving', desc: 'Daylight, 50 km/h, active crosswalks & traffic' },
                  { id: 'highway', title: 'Highway Transit', desc: 'High-speed 80 km/h cruising with distance fog' },
                  { id: 'rain', title: 'Rain Weather', desc: 'Precipitation particles, 45% reduced tire grip' },
                  { id: 'night', title: 'Night Driving', desc: 'Low ambient light, street lamps & headlights' }
                ].map(scen => (
                  <button
                    key={scen.id}
                    onClick={() => setSelectedScenario(scen.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedScenario === scen.id
                        ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{scen.title}</span>
                      {selectedScenario === scen.id && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{scen.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                onClick={() => {
                  setGameState('driving');
                  resetVehicle();
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-600/30 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span className="capitalize">Start Training Drive ({selectedScenario} Mode)</span>
              </button>

              <button
                onClick={() => resetVehicle()}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl text-xs transition-colors"
              >
                Reset Simulator
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>W/S: Drive &amp; Reverse</span>
              <span>A/D: Steer</span>
              <span>C: Switch Camera</span>
              <span>Space: Brake</span>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MENU */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Simulation Paused</h2>
              <p className="text-xs text-slate-400">Time.timeScale = 0f (Physics frozen)</p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => setGameState('driving')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Resume Driving
              </button>
              <button
                onClick={() => {
                  resetVehicle();
                  setGameState('driving');
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors"
              >
                Restart Course
              </button>
              <button
                onClick={() => setGameState('menu')}
                className="w-full py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white font-medium rounded-lg text-xs transition-colors"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME HUD: SPEEDOMETER, ROUTE, & PHASE 3 DRIVING SCORE */}
      {gameState === 'driving' && (
        <>
          {/* Bottom-Left: Speedometer, Gear & Live Score HUD */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-2 pointer-events-none">
            {/* Phase 3 Live Driving Score Card */}
            <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/80 shadow-2xl flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Driver Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black font-mono text-white">{drivingScore}</span>
                    <span className="text-[10px] text-slate-400">/ 100</span>
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-7 bg-slate-700" />

              {/* Tier Classification Badge */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getScoreColor(drivingScore)}`}>
                {drivingScore >= 90 ? 'Excellent' : drivingScore >= 75 ? 'Good' : drivingScore >= 60 ? 'Needs Improvement' : 'Unsafe'}
              </span>

              <div className="w-[1px] h-7 bg-slate-700" />

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] font-mono text-slate-300">
                {selectedScenario === 'rain' && <CloudRain className="w-3 h-3 text-cyan-400" />}
                {selectedScenario === 'night' && <Moon className="w-3 h-3 text-indigo-400" />}
                {selectedScenario === 'highway' && <Compass className="w-3 h-3 text-sky-400" />}
                {selectedScenario === 'city' && <Sun className="w-3 h-3 text-amber-400" />}
                <span className="uppercase font-semibold">
                  {selectedScenario === 'rain' ? 'Wet Grip (0.55)' : selectedScenario === 'night' ? 'Night / Lights' : selectedScenario === 'highway' ? 'Hwy 80 Limit' : 'City 50 Limit'}
                </span>
              </div>

              <div className="w-[1px] h-7 bg-slate-700" />

              {/* Phase 5 Live G-Force Acceleration Meter */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] font-mono">
                <Activity className="w-3 h-3 text-sky-400" />
                <span className={`font-bold ${currentAccel <= -6.5 ? 'text-rose-400 animate-pulse font-black' : currentAccel >= 4.5 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {currentAccel > 0 ? `+${currentAccel.toFixed(1)}` : `${currentAccel.toFixed(1)}`} m/s²
                </span>
              </div>

              <div className="w-[1px] h-7 bg-slate-700" />

              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-mono text-slate-300">
                  {currentCheckpointIndex}/4 CPs
                </span>
              </div>
            </div>

            {/* Speedometer & Gear Gauge */}
            <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700/80 shadow-2xl flex items-center gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Speed (Limit: {selectedScenario === 'highway' ? 80 : 50})
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-4xl font-extrabold font-mono tabular-nums tracking-tight ${
                      telemetry.speedKmh > (selectedScenario === 'highway' ? 83 : 53) ? 'text-rose-400 animate-pulse' : 'text-white'
                    }`}
                  >
                    {telemetry.speedKmh}
                  </span>
                  <span className="text-xs font-semibold text-sky-400 uppercase">km/h</span>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-slate-700/70" />

              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Gear</span>
                <div className="flex items-center gap-1 mt-0.5">
                  {(['P', 'R', 'N', 'D'] as const).map(gear => {
                    const isActive = telemetry.currentGear === gear;
                    return (
                      <span
                        key={gear}
                        className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold font-mono transition-all ${
                          isActive
                            ? gear === 'R'
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                              : gear === 'P'
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                              : 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-slate-500 bg-slate-800/40'
                        }`}
                      >
                        {gear}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Buttons for testing */}
          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-lg">
              <button
                onClick={() => {
                  blinkStateRef.current.left = !blinkStateRef.current.left;
                  if (blinkStateRef.current.left) blinkStateRef.current.right = false;
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-slate-300 rounded text-[10px] font-bold transition-colors"
                title="Left Turn Blinker [Q]"
              >
                ◀ [Q]
              </button>
              <button
                onClick={() => audioEngineRef.current?.playHorn()}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-300 rounded text-[10px] font-bold transition-colors"
                title="Vehicle Horn [B]"
              >
                Horn [B]
              </button>
              <button
                onClick={() => {
                  blinkStateRef.current.right = !blinkStateRef.current.right;
                  if (blinkStateRef.current.right) blinkStateRef.current.left = false;
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-slate-300 rounded text-[10px] font-bold transition-colors"
                title="Right Turn Blinker [E]"
              >
                [E] ▶
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => (keysRef.current.left = true)}
                onMouseUp={() => (keysRef.current.left = false)}
                onTouchStart={() => (keysRef.current.left = true)}
                onTouchEnd={() => (keysRef.current.left = false)}
                className="w-12 h-12 bg-slate-800/90 active:bg-blue-600 text-white font-bold rounded-xl border border-slate-700 flex items-center justify-center text-sm shadow-lg select-none"
              >
                ◀ A
              </button>
              <button
                onMouseDown={() => (keysRef.current.right = true)}
                onMouseUp={() => (keysRef.current.right = false)}
                onTouchStart={() => (keysRef.current.right = true)}
                onTouchEnd={() => (keysRef.current.right = false)}
                className="w-12 h-12 bg-slate-800/90 active:bg-blue-600 text-white font-bold rounded-xl border border-slate-700 flex items-center justify-center text-sm shadow-lg select-none"
              >
                D ▶
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => (keysRef.current.handbrake = true)}
                onMouseUp={() => (keysRef.current.handbrake = false)}
                onTouchStart={() => (keysRef.current.handbrake = true)}
                onTouchEnd={() => (keysRef.current.handbrake = false)}
                className="px-3 h-12 bg-slate-800/90 active:bg-rose-600 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs shadow-lg select-none"
              >
                Handbrake
              </button>
              <button
                onMouseDown={() => (keysRef.current.backward = true)}
                onMouseUp={() => (keysRef.current.backward = false)}
                onTouchStart={() => (keysRef.current.backward = true)}
                onTouchEnd={() => (keysRef.current.backward = false)}
                className="w-14 h-12 bg-amber-600/90 active:bg-amber-500 text-white font-bold rounded-xl border border-amber-500 flex items-center justify-center text-xs shadow-lg select-none"
              >
                Brake / R
              </button>
              <button
                onMouseDown={() => (keysRef.current.forward = true)}
                onMouseUp={() => (keysRef.current.forward = false)}
                onTouchStart={() => (keysRef.current.forward = true)}
                onTouchEnd={() => (keysRef.current.forward = false)}
                className="w-14 h-12 bg-emerald-600/90 active:bg-emerald-500 text-white font-bold rounded-xl border border-emerald-500 flex items-center justify-center text-xs shadow-lg select-none"
              >
                Drive ▲
              </button>
            </div>
          </div>
        </>
      )}

      {/* PHASE 5: DRIVER BEHAVIOUR ASSESSMENT MODAL */}
      {showAssessmentModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 lg:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto scrollbar-thin">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Driver Behaviour Assessment</h3>
                  <p className="text-xs text-slate-400">Phase 5 Academic Grading &amp; Explainable Feedback</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssessmentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score & Classification Header Banner */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Final Driving Score</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black font-mono text-white">{assessmentReport.score}</span>
                  <span className="text-xs text-slate-500 font-mono">/ 100 Baseline</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver Classification</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getScoreColor(assessmentReport.score)}`}>
                  {assessmentReport.classification}
                </span>
              </div>
            </div>

            {/* Explainable Natural Language Synthesis Card */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider">Explainable Driver Evaluation</h4>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                &ldquo;{assessmentReport.summaryParagraph}&rdquo;
              </p>
            </div>

            {/* Strengths & Infractions Two-Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-emerald-950/60 space-y-2.5">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Positive Driving Habits</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {assessmentReport.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 text-xs mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Infractions / Mistakes */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-rose-950/60 space-y-2.5">
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Identified Infractions</span>
                </div>
                {assessmentReport.infractions.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {assessmentReport.infractions.map((inf, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-400 text-xs mt-0.5">•</span>
                        <span>{inf}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">No moving violations or penalty infractions recorded!</p>
                )}
              </div>
            </div>

            {/* Actionable Recommendations */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-amber-950/60 space-y-2.5">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Actionable Training Recommendations
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {assessmentReport.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 text-xs mt-0.5">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Telemetry Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Drive Duration</span>
                <span className="text-sm font-bold font-mono text-white">{assessmentReport.durationSec}s</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Avg / Max Speed</span>
                <span className="text-sm font-bold font-mono text-white">{assessmentReport.avgSpeed} / {assessmentReport.maxSpeed} km/h</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Hard Brakes</span>
                <span className="text-sm font-bold font-mono text-amber-400">{assessmentReport.stats.hardBrakes}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Collisions / Red Lights</span>
                <span className="text-sm font-bold font-mono text-rose-400">{assessmentReport.stats.collisions} / {assessmentReport.stats.redLights}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={downloadTelemetryCsv}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                title="Download 10 Hz time-series telemetry data file"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export Telemetry CSV ({telemetrySamplesRef.current.length} samples)</span>
              </button>

              <div className="flex items-center gap-2">
                {onNavigateToDashboard && (
                  <button
                    onClick={() => {
                      setShowAssessmentModal(false);
                      onNavigateToDashboard();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>View in Dashboard</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAssessmentModal(false);
                    resetVehicle();
                    setGameState('driving');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
                >
                  Restart Course
                </button>
                <button
                  onClick={() => setShowAssessmentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
