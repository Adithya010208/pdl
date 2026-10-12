export interface UnityStep {
  stepNumber: number;
  title: string;
  category:
    | "Setup"
    | "Environment"
    | "Vehicle"
    | "Camera"
    | "UI"
    | "Management"
    | "Testing"
    | "Audio"
    | "Visuals"
    | "Reporting";
  whatToCreate: string;
  whereToCreate: string;
  gameObjectsRequired: string[];
  componentsToAdd: {
    targetObject: string;
    component: string;
    settings: Record<string, string>;
  }[];
  inspectorConfiguration: {
    field: string;
    type: string;
    value: string;
    notes?: string;
  }[];
  scriptFileName?: string;
  scriptCode?: string;
  howToConnect: string[];
  howToTest: string[];
  proTips?: string[];
}

export interface CSharpScript {
  id: string;
  name: string;
  filePath: string;
  summary: string;
  code: string;
  inspectorFields: {
    name: string;
    type: string;
    defaultValue: string;
    description: string;
  }[];
}

export interface VehicleTelemetry {
  speedKmh: number;
  engineRpm: number;
  currentGear: "P" | "R" | "N" | "D";
  steerAngle: number;
  motorTorque: number;
  brakeTorque: number;
  isHandbraking: boolean;
  distanceTraveled: number;
}

export interface ProjectPhase {
  phaseNumber: number;
  name: string;
  status: "Completed" | "Ready for Implementation" | "Planned";
  deliverables: string[];
  keyComponents: string[];
  description: string;
}

export interface DrivingSessionData {
  sessionId: string;
  driverId: string;
  scenarioName: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  averageSpeedKmh: number;
  maximumSpeedKmh: number;
  collisionCount: number;
  overspeedEvents: number;
  redLightViolations: number;
  laneViolations: number;
  hardBrakingEvents: number;
  missedCheckpoints: number;
  finalScore: number;
  classification: "Excellent" | "Good" | "Needs Improvement" | "Unsafe Driving";
  feedbackNotes: string[];
  distanceMeters?: number;
  routeCompleted?: boolean;
}

export interface TelemetrySample {
  timestamp: number;
  speedKmh: number;
  accelerationMs2: number;
  throttle: number;
  brake: number;
  steerAngleDeg: number;
  posX: number;
  posY: number;
  posZ: number;
  speedLimitKmh: number;
  isHardBraking: boolean;
  isAggressiveAccel: boolean;
}

export interface ExplainableAssessmentReport {
  score: number;
  classification: "Excellent" | "Good" | "Needs Improvement" | "Unsafe Driving";
  summaryParagraph: string;
  positiveBehaviors: string[];
  mistakes: string[];
  recommendations: string[];
  metrics: {
    durationSeconds: number;
    distanceMeters: number;
    averageSpeedKmh: number;
    topSpeedKmh: number;
    hardBrakingCount: number;
    aggressiveAccelCount: number;
    overspeedCount: number;
    redLightCount: number;
    laneViolationCount: number;
    collisionCount: number;
    checkpointsCleared: number;
  };
}

export interface DriverProfile {
  id: string;
  name: string;
  licenseType:
    | "Student Permit"
    | "Provisional License"
    | "Class C Driver"
    | "Professional Instructor";
  badge: string;
  createdDate: string;
  totalSessions: number;
  totalDistanceKm: number;
  totalDriveTimeMinutes: number;
  averageScore: number;
  bestScore: number;
  safetyTier: "Excellent" | "Good" | "Needs Improvement" | "Unsafe Driving";
}

export interface DriverProgressStats {
  scoreHistory: {
    date: string;
    score: number;
    scenario: string;
    sessionNumber: number;
  }[];
  violationAggregates: {
    totalCollisions: number;
    totalRedLights: number;
    totalOverspeed: number;
    totalLaneViolations: number;
    totalHardBrakes: number;
  };
  scenarioPassRates: Record<
    string,
    { totalDrives: number; avgScore: number; passRate: number }
  >;
}
