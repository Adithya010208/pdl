import { UnityStep, CSharpScript } from '../types/simulator';

export const UNITY_SCRIPTS: CSharpScript[] = [
  {
    id: 'vehicle-input',
    name: 'VehicleInput.cs',
    filePath: 'Assets/Scripts/Vehicle/VehicleInput.cs',
    summary: 'Decoupled input reader handling keyboard/controller axes. Separates player input from vehicle physics for modularity.',
    inspectorFields: [
      { name: 'horizontalAxis', type: 'string', defaultValue: '"Horizontal"', description: 'Unity Input Manager axis for steering (A/D or Left/Right)' },
      { name: 'verticalAxis', type: 'string', defaultValue: '"Vertical"', description: 'Unity Input Manager axis for throttle/brake (W/S or Up/Down)' },
      { name: 'handbrakeKey', type: 'KeyCode', defaultValue: 'KeyCode.Space', description: 'Key assigned to apply the emergency handbrake' }
    ],
    code: `using UnityEngine;

namespace Simulator.Vehicle
{
    /// <summary>
    /// Reads player input and provides clean properties for vehicle control.
    /// Decoupling input from physics allows easy swapping to AI or mobile virtual controls later.
    /// </summary>
    public class VehicleInput : MonoBehaviour
    {
        [Header("Input Axis Names")]
        [Tooltip("Horizontal axis name defined in Project Settings > Input Manager (A/D or Arrows)")]
        [SerializeField] private string horizontalAxis = "Horizontal";

        [Tooltip("Vertical axis name defined in Project Settings > Input Manager (W/S or Arrows)")]
        [SerializeField] private string verticalAxis = "Vertical";

        [Tooltip("Key mapped to activate handbrake")]
        [SerializeField] private KeyCode handbrakeKey = KeyCode.Space;

        // Exposed properties for CarController
        public float ThrottleInput { get; private set; }
        public float SteerInput { get; private set; }
        public bool IsHandbrakePressed { get; private set; }

        private void Update()
        {
            // Capture raw or smoothed axes (-1.0f to +1.0f)
            ThrottleInput = Input.GetAxis(verticalAxis);
            SteerInput = Input.GetAxis(horizontalAxis);
            IsHandbrakePressed = Input.GetKey(handbrakeKey);
        }
    }
}`
  },
  {
    id: 'car-controller',
    name: 'CarController.cs',
    filePath: 'Assets/Scripts/Vehicle/CarController.cs',
    summary: 'Core physics driver using Unity Rigidbody and WheelColliders with custom center-of-mass, realistic acceleration, reverse gear, steering, and visual wheel sync.',
    inspectorFields: [
      { name: 'maxMotorTorque', type: 'float', defaultValue: '1600f', description: 'Motor torque applied to drive wheels (in Newton-meters)' },
      { name: 'maxBrakeTorque', type: 'float', defaultValue: '3200f', description: 'Foot brake torque applied when pressing opposite direction' },
      { name: 'handbrakeTorque', type: 'float', defaultValue: '6500f', description: 'Braking torque applied strictly to rear wheels on Spacebar' },
      { name: 'maxSteerAngle', type: 'float', defaultValue: '32f', description: 'Maximum steering angle in degrees for front wheels' },
      { name: 'maxForwardSpeedKmh', type: 'float', defaultValue: '130f', description: 'Top speed limit in km/h' },
      { name: 'maxReverseSpeedKmh', type: 'float', defaultValue: '35f', description: 'Top reverse speed limit in km/h' },
      { name: 'centerOfMassOffset', type: 'Vector3', defaultValue: '(0, -0.55, 0.2)', description: 'Lowered Center of Mass to prevent flipping in turns' }
    ],
    code: `using UnityEngine;

namespace Simulator.Vehicle
{
    public enum GearMode
    {
        Park,
        Neutral,
        Drive,
        Reverse
    }

    /// <summary>
    /// Realistic yet beginner-friendly vehicle controller using Unity WheelColliders & Rigidbody.
    /// Calculates real Rigidbody velocity in km/h and handles smooth acceleration, braking, and reverse.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(VehicleInput))]
    public class CarController : MonoBehaviour
    {
        [Header("Wheel Colliders")]
        [SerializeField] private WheelCollider frontLeftCollider;
        [SerializeField] private WheelCollider frontRightCollider;
        [SerializeField] private WheelCollider rearLeftCollider;
        [SerializeField] private WheelCollider rearRightCollider;

        [Header("Visual Wheel Transforms")]
        [SerializeField] private Transform frontLeftTransform;
        [SerializeField] private Transform frontRightTransform;
        [SerializeField] private Transform rearLeftTransform;
        [SerializeField] private Transform rearRightTransform;

        [Header("Engine & Transmission")]
        [Tooltip("Motor torque applied to wheels (Nm)")]
        [SerializeField] private float maxMotorTorque = 1600f;
        [Tooltip("Standard service brake torque (Nm)")]
        [SerializeField] private float maxBrakeTorque = 3200f;
        [Tooltip("Handbrake torque applied to rear wheels (Nm)")]
        [SerializeField] private float handbrakeTorque = 6500f;
        [Tooltip("Maximum steering angle in degrees")]
        [SerializeField] private float maxSteerAngle = 32f;
        [Tooltip("Top forward speed in km/h")]
        [SerializeField] private float maxForwardSpeedKmh = 130f;
        [Tooltip("Top reverse speed in km/h")]
        [SerializeField] private float maxReverseSpeedKmh = 35f;

        [Header("Center of Mass (Anti-Roll Stability)")]
        [Tooltip("Offset relative to vehicle origin. Lower Y prevents rollover.")]
        [SerializeField] private Vector3 centerOfMassOffset = new Vector3(0f, -0.55f, 0.2f);

        // References & State
        private Rigidbody rb;
        private VehicleInput vehicleInput;

        public float CurrentSpeedKmh { get; private set; }
        public GearMode CurrentGear { get; private set; } = GearMode.Neutral;
        public float SteerAngle { get; private set; }

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            vehicleInput = GetComponent<VehicleInput>();

            // Crucial for vehicle stability: lower the Center of Mass
            rb.centerOfMass += centerOfMassOffset;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
        }

        private void FixedUpdate()
        {
            CalculateSpeed();
            HandleMotorAndBrakes();
            HandleSteering();
            UpdateVisualWheels();
        }

        private void CalculateSpeed()
        {
            // Calculate actual physical forward velocity in km/h (1 m/s = 3.6 km/h)
            // Dot product determines if vehicle is traveling forwards or backwards relative to its chassis
            Vector3 forwardVelocity = Vector3.Project(rb.linearVelocity, transform.forward);
            float forwardDot = Vector3.Dot(rb.linearVelocity, transform.forward);

            CurrentSpeedKmh = forwardVelocity.magnitude * 3.6f;

            if (CurrentSpeedKmh < 1.0f)
            {
                CurrentGear = vehicleInput.IsHandbrakePressed ? GearMode.Park : GearMode.Neutral;
            }
            else if (forwardDot >= 0f)
            {
                CurrentGear = GearMode.Drive;
            }
            else
            {
                CurrentGear = GearMode.Reverse;
            }
        }

        private void HandleMotorAndBrakes()
        {
            float throttle = vehicleInput.ThrottleInput;
            bool isHandbraking = vehicleInput.IsHandbrakePressed;

            // Dot product shows if we are currently moving forward
            float forwardDot = Vector3.Dot(rb.linearVelocity, transform.forward);
            bool isMovingForward = forwardDot > 0.5f;
            bool isMovingBackward = forwardDot < -0.5f;

            float motor = 0f;
            float brake = 0f;

            if (isHandbraking)
            {
                // Handbrake locks rear wheels
                rearLeftCollider.brakeTorque = handbrakeTorque;
                rearRightCollider.brakeTorque = handbrakeTorque;
                frontLeftCollider.motorTorque = 0f;
                frontRightCollider.motorTorque = 0f;
                return;
            }

            // Normal driving logic:
            if (throttle > 0.05f) // Pressing W / Up Arrow
            {
                if (isMovingBackward && CurrentSpeedKmh > 1.5f)
                {
                    // Braking while rolling reverse
                    brake = maxBrakeTorque * throttle;
                }
                else if (CurrentSpeedKmh < maxForwardSpeedKmh)
                {
                    // Accelerating forward
                    motor = maxMotorTorque * throttle;
                }
            }
            else if (throttle < -0.05f) // Pressing S / Down Arrow
            {
                if (isMovingForward && CurrentSpeedKmh > 1.5f)
                {
                    // Braking while moving forward
                    brake = maxBrakeTorque * Mathf.Abs(throttle);
                }
                else if (CurrentSpeedKmh < maxReverseSpeedKmh)
                {
                    // Reversing once stopped
                    motor = maxMotorTorque * throttle; // negative torque drives in reverse
                }
            }
            else
            {
                // Engine idling / coasting
                motor = 0f;
                brake = 25f; // Slight rolling resistance
            }

            // Apply motor torque (Rear-Wheel Drive for standard car feel)
            rearLeftCollider.motorTorque = motor;
            rearRightCollider.motorTorque = motor;

            // Apply service brakes to all wheels
            frontLeftCollider.brakeTorque = brake;
            frontRightCollider.brakeTorque = brake;
            rearLeftCollider.brakeTorque = brake;
            rearRightCollider.brakeTorque = brake;
        }

        private void HandleSteering()
        {
            // Steer front wheels
            SteerAngle = maxSteerAngle * vehicleInput.SteerInput;
            frontLeftCollider.steerAngle = SteerAngle;
            frontRightCollider.steerAngle = SteerAngle;
        }

        private void UpdateVisualWheels()
        {
            UpdateWheelPose(frontLeftCollider, frontLeftTransform);
            UpdateWheelPose(frontRightCollider, frontRightTransform);
            UpdateWheelPose(rearLeftCollider, rearLeftTransform);
            UpdateWheelPose(rearRightCollider, rearRightTransform);
        }

        private void UpdateWheelPose(WheelCollider col, Transform trans)
        {
            if (col == null || trans == null) return;

            col.GetWorldPose(out Vector3 position, out Quaternion rotation);
            trans.position = position;
            trans.rotation = rotation;
        }
    }
}`
  },
  {
    id: 'follow-camera',
    name: 'FollowCamera.cs',
    filePath: 'Assets/Scripts/Camera/FollowCamera.cs',
    summary: 'Smooth third-person chase camera positioned behind the vehicle with position dampening and rotation look-ahead.',
    inspectorFields: [
      { name: 'target', type: 'Transform', defaultValue: 'Car GameObject', description: 'Transform of the car to follow' },
      { name: 'distance', type: 'float', defaultValue: '6.2f', description: 'Distance in meters behind the car' },
      { name: 'height', type: 'float', defaultValue: '2.5f', description: 'Height in meters above the car' },
      { name: 'positionSmoothTime', type: 'float', defaultValue: '0.12f', description: 'Position damping time (lower is tighter)' },
      { name: 'rotationDamping', type: 'float', defaultValue: '6.0f', description: 'Rotation interpolation speed' },
      { name: 'lookAtHeightOffset', type: 'float', defaultValue: '1.0f', description: 'Aim point offset above car pivot' }
    ],
    code: `using UnityEngine;

namespace Simulator.CameraControl
{
    /// <summary>
    /// Third-person camera that follows smoothly behind the vehicle.
    /// Runs in LateUpdate to ensure jitter-free motion after physics has updated.
    /// </summary>
    public class FollowCamera : MonoBehaviour
    {
        [Header("Target")]
        [Tooltip("The vehicle Transform to track")]
        [SerializeField] private Transform target;

        [Header("Positioning & Offset")]
        [Tooltip("Horizontal distance behind the vehicle")]
        [SerializeField] private float distance = 6.2f;

        [Tooltip("Vertical height above the vehicle")]
        [SerializeField] private float height = 2.5f;

        [Tooltip("Height offset for the camera look-at target")]
        [SerializeField] private float lookAtHeightOffset = 1.0f;

        [Header("Smoothing Parameters")]
        [Tooltip("SmoothDamp time for camera position (seconds)")]
        [SerializeField] private float positionSmoothTime = 0.12f;

        [Tooltip("Speed at which camera slerps to vehicle heading")]
        [SerializeField] private float rotationDamping = 6.0f;

        private Vector3 currentVelocity = Vector3.zero;

        private void LateUpdate()
        {
            if (target == null) return;

            // Calculate desired position directly behind car based on vehicle's current orientation
            Vector3 targetForward = target.forward;
            targetForward.y = 0f;
            targetForward.Normalize();

            Vector3 desiredPosition = target.position - (targetForward * distance) + (Vector3.up * height);

            // Smoothly move camera towards desired position
            transform.position = Vector3.SmoothDamp(transform.position, desiredPosition, ref currentVelocity, positionSmoothTime);

            // Calculate aim point (look slightly above car center so road ahead is clearly visible)
            Vector3 lookTarget = target.position + Vector3.up * lookAtHeightOffset;
            Vector3 directionToTarget = lookTarget - transform.position;

            if (directionToTarget.sqrMagnitude > 0.001f)
            {
                Quaternion targetRotation = Quaternion.LookRotation(directionToTarget, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationDamping * Time.deltaTime);
            }
        }
    }
}`
  },
  {
    id: 'speedometer-ui',
    name: 'SpeedometerUI.cs',
    filePath: 'Assets/Scripts/UI/SpeedometerUI.cs',
    summary: 'Heads-Up Display script displaying actual Rigidbody velocity in km/h and current transmission gear (D/R/P/N).',
    inspectorFields: [
      { name: 'carController', type: 'CarController', defaultValue: 'Player Car reference', description: 'Reference to the active CarController' },
      { name: 'speedText', type: 'TMP_Text / Text', defaultValue: 'SpeedText element', description: 'UI Text displaying "Speed: XX km/h"' },
      { name: 'gearText', type: 'TMP_Text / Text', defaultValue: 'GearText element', description: 'UI Text displaying [D], [R], [P], or [N]' }
    ],
    code: `using UnityEngine;
using UnityEngine.UI;

namespace Simulator.UI
{
    /// <summary>
    /// Displays vehicle telemetry (physical speed in km/h and gear indicator) on the HUD Canvas.
    /// Supports both standard UnityEngine.UI.Text and TextMeshProUGUI.
    /// </summary>
    public class SpeedometerUI : MonoBehaviour
    {
        [Header("Vehicle Reference")]
        [Tooltip("The player's CarController script")]
        [SerializeField] private Vehicle.CarController carController;

        [Header("HUD Text Elements")]
        [Tooltip("Text showing 'Speed: XX km/h'")]
        [SerializeField] private Text speedText;

        [Tooltip("Text showing gear [D] [R] [P] [N]")]
        [SerializeField] private Text gearText;

        private void Update()
        {
            if (carController == null) return;

            // Get authentic Rigidbody speed
            int speedInt = Mathf.RoundToInt(carController.CurrentSpeedKmh);

            if (speedText != null)
            {
                speedText.text = $"Speed: {speedInt} km/h";
            }

            if (gearText != null)
            {
                switch (carController.CurrentGear)
                {
                    case Vehicle.GearMode.Drive:
                        gearText.text = "GEAR: [ D ]";
                        gearText.color = Color.white;
                        break;
                    case Vehicle.GearMode.Reverse:
                        gearText.text = "GEAR: [ R ]";
                        gearText.color = new Color(1f, 0.4f, 0.2f);
                        break;
                    case Vehicle.GearMode.Park:
                        gearText.text = "GEAR: [ P ] (Handbrake)";
                        gearText.color = new Color(1f, 0.25f, 0.25f);
                        break;
                    case Vehicle.GearMode.Neutral:
                    default:
                        gearText.text = "GEAR: [ N ]";
                        gearText.color = Color.gray;
                        break;
                }
            }
        }
    }
}`
  },
  {
    id: 'game-manager',
    name: 'GameManager.cs',
    filePath: 'Assets/Scripts/GameManager.cs',
    summary: 'Controls scene transitions (Main Menu to Driving Scene), Time.timeScale pausing via Escape or button, and clean restart.',
    inspectorFields: [
      { name: 'pauseMenuPanel', type: 'GameObject', defaultValue: 'PausePanel (Canvas)', description: 'Canvas panel activated when paused' },
      { name: 'mainMenuSceneName', type: 'string', defaultValue: '"MainMenu"', description: 'Name of the Main Menu scene' },
      { name: 'drivingSceneName', type: 'string', defaultValue: '"DrivingScene"', description: 'Name of the Driving Scene' }
    ],
    code: `using UnityEngine;
using UnityEngine.SceneManagement;

namespace Simulator
{
    /// <summary>
    /// Coordinates high-level application flow:
    /// - Scene switching (Main Menu <-> Driving Scene)
    /// - Pause toggle (Escape key or on-screen Pause button)
    /// - Freezing Time.timeScale without breaking UI
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Scene Names")]
        [SerializeField] private string mainMenuSceneName = "MainMenu";
        [SerializeField] private string drivingSceneName = "DrivingScene";

        [Header("Pause UI Reference (Optional in MainMenu)")]
        [Tooltip("The UI Panel that appears when the game is paused")]
        [SerializeField] private GameObject pauseMenuPanel;

        public bool IsPaused { get; private set; }

        private void Awake()
        {
            // Singleton pattern ensuring access across scripts
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Ensure physics time is normal on start
            Time.timeScale = 1f;

            if (pauseMenuPanel != null)
            {
                pauseMenuPanel.SetActive(false);
            }
        }

        private void Update()
        {
            // Escape toggles pause in Driving Scene
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                TogglePause();
            }
        }

        public void StartDriving()
        {
            Time.timeScale = 1f;
            SceneManagement.SceneManager.LoadScene(drivingSceneName);
        }

        public void TogglePause()
        {
            IsPaused = !IsPaused;

            if (pauseMenuPanel != null)
            {
                pauseMenuPanel.SetActive(IsPaused);
            }

            // Freeze physical simulation when paused
            Time.timeScale = IsPaused ? 0f : 1f;
        }

        public void ResumeGame()
        {
            IsPaused = false;
            if (pauseMenuPanel != null)
            {
                pauseMenuPanel.SetActive(false);
            }
            Time.timeScale = 1f;
        }

        public void RestartDrivingScene()
        {
            Time.timeScale = 1f;
            SceneManagement.SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }

        public void ReturnToMainMenu()
        {
            Time.timeScale = 1f;
            SceneManagement.SceneManager.LoadScene(mainMenuSceneName);
        }

        public void ExitApplication()
        {
            Debug.Log("Quit requested from Car Driving Simulator.");
            #if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
            #else
            Application.Quit();
            #endif
        }
    }
}`
  },
  {
    id: 'camera-manager',
    name: 'CameraManager.cs',
    filePath: 'Assets/Scripts/Camera/CameraManager.cs',
    summary: 'Manages seamless switching between Third-Person Chase, First-Person Cockpit, and Dashboard/Bumper cameras with hotkey and UI bindings.',
    inspectorFields: [
      { name: 'thirdPersonCamera', type: 'Camera', defaultValue: 'Main Camera (with FollowCamera.cs)', description: 'Third-person chase camera trailing behind the car' },
      { name: 'firstPersonCamera', type: 'Camera', defaultValue: 'FirstPersonCamera (driver eye level)', description: 'Interior cockpit camera positioned at driver eye level' },
      { name: 'dashboardCamera', type: 'Camera', defaultValue: 'DashboardCamera (front hood mount)', description: 'Forward-looking camera mounted on the hood/dashboard' },
      { name: 'cycleCameraKey', type: 'KeyCode', defaultValue: 'KeyCode.C', description: 'Keyboard shortcut to toggle between the 3 views' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.CameraControl
{
    public enum CameraViewMode
    {
        ThirdPerson = 0,
        FirstPerson = 1,
        Dashboard = 2
    }

    /// <summary>
    /// Coordinates multi-camera switching (Third-Person Chase, First-Person Interior, Dashboard Bumper).
    /// Preserves existing FollowCamera behavior while providing realistic training perspectives.
    /// </summary>
    public class CameraManager : MonoBehaviour
    {
        public static CameraManager Instance { get; private set; }

        [Header("Camera References")]
        [Tooltip("Standard 3rd-person chase camera (FollowCamera.cs attached)")]
        [SerializeField] private Camera thirdPersonCamera;

        [Tooltip("1st-person camera positioned inside cabin at driver eye level")]
        [SerializeField] private Camera firstPersonCamera;

        [Tooltip("Dashboard/hood camera giving close road view")]
        [SerializeField] private Camera dashboardCamera;

        [Header("Input Shortcut")]
        [Tooltip("Key to cycle active camera views")]
        [SerializeField] private KeyCode cycleCameraKey = KeyCode.C;

        [Header("Initial State")]
        [SerializeField] private CameraViewMode initialMode = CameraViewMode.ThirdPerson;

        public CameraViewMode CurrentMode { get; private set; }

        // Event for UI notifications
        public event Action<CameraViewMode> OnCameraChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            SetCameraMode(initialMode);
        }

        private void Update()
        {
            if (Input.GetKeyDown(cycleCameraKey))
            {
                CycleNextCamera();
            }
        }

        public void CycleNextCamera()
        {
            int nextModeIndex = ((int)CurrentMode + 1) % 3;
            SetCameraMode((CameraViewMode)nextModeIndex);
        }

        public void SetCameraMode(CameraViewMode mode)
        {
            CurrentMode = mode;

            // Enable only the active camera to maximize performance
            if (thirdPersonCamera != null) thirdPersonCamera.gameObject.SetActive(mode == CameraViewMode.ThirdPerson);
            if (firstPersonCamera != null) firstPersonCamera.gameObject.SetActive(mode == CameraViewMode.FirstPerson);
            if (dashboardCamera != null) dashboardCamera.gameObject.SetActive(mode == CameraViewMode.Dashboard);

            OnCameraChanged?.Invoke(CurrentMode);
        }

        public string GetCurrentModeDisplayName()
        {
            switch (CurrentMode)
            {
                case CameraViewMode.FirstPerson:
                    return "1st-Person Cockpit";
                case CameraViewMode.Dashboard:
                    return "Dashboard / Hood";
                case CameraViewMode.ThirdPerson:
                default:
                    return "3rd-Person Chase";
            }
        }
    }
}`
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint.cs',
    filePath: 'Assets/Scripts/Environment/Checkpoint.cs',
    summary: 'Trigger collider marking sequential navigation points. Manages visual glow and fires entry events.',
    inspectorFields: [
      { name: 'checkpointIndex', type: 'int', defaultValue: '0', description: 'Zero-based sequence order of this checkpoint' },
      { name: 'isPassed', type: 'bool', defaultValue: 'false', description: 'Whether the player has successfully cleared this checkpoint' },
      { name: 'activeColor', type: 'Color', defaultValue: 'Cyan / Sky Blue', description: 'Color of marker mesh when awaiting clearance' },
      { name: 'clearedColor', type: 'Color', defaultValue: 'Emerald Green', description: 'Color of marker mesh once cleared' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Environment
{
    /// <summary>
    /// Represents a discrete checkpoint gate on the road network.
    /// Triggers when the player vehicle crosses its boundary.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class Checkpoint : MonoBehaviour
    {
        [Header("Checkpoint Metadata")]
        [Tooltip("Sequential sequence number (0, 1, 2...)")]
        [SerializeField] private int checkpointIndex;

        [Header("Visual Feedback")]
        [SerializeField] private Renderer markerRenderer;
        [SerializeField] private Color activeColor = new Color(0.2f, 0.6f, 1f, 0.7f);
        [SerializeField] private Color clearedColor = new Color(0.1f, 0.9f, 0.3f, 0.4f);

        public int CheckpointIndex => checkpointIndex;
        public bool IsPassed { get; private set; }

        public event Action<Checkpoint, GameObject> OnVehicleEntered;

        private void Awake()
        {
            // Ensure collider acts as trigger volume
            Collider col = GetComponent<Collider>();
            col.isTrigger = true;

            UpdateMarkerAppearance();
        }

        public void SetPassed(bool passed)
        {
            IsPassed = passed;
            UpdateMarkerAppearance();
        }

        private void UpdateMarkerAppearance()
        {
            if (markerRenderer != null && markerRenderer.material != null)
            {
                markerRenderer.material.color = IsPassed ? clearedColor : activeColor;
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            // Detect if vehicle (or child collider of vehicle) entered
            if (other.CompareTag("Player") || other.transform.root.CompareTag("Player"))
            {
                OnVehicleEntered?.Invoke(this, other.transform.root.gameObject);
            }
        }
    }
}`
  },
  {
    id: 'checkpoint-manager',
    name: 'CheckpointManager.cs',
    filePath: 'Assets/Scripts/Environment/CheckpointManager.cs',
    summary: 'Coordinates the ordered route, tracks distance to target, validates sequence progression, and detects destination completion.',
    inspectorFields: [
      { name: 'checkpoints', type: 'List<Checkpoint>', defaultValue: 'List of Checkpoint instances', description: 'Ordered sequential checkpoints along the route' },
      { name: 'destinationTrigger', type: 'Collider', defaultValue: 'DestinationZone (BoxCollider trigger)', description: 'Final destination parking / stop zone trigger' },
      { name: 'playerTransform', type: 'Transform', defaultValue: 'Car_Player Transform', description: 'Player vehicle reference for distance calculations' }
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simulator.Environment
{
    /// <summary>
    /// Tracks driver progression through designated route checkpoints and destination.
    /// Enforces sequence order to detect missed checkpoints in later assessment phases.
    /// </summary>
    public class CheckpointManager : MonoBehaviour
    {
        public static CheckpointManager Instance { get; private set; }

        [Header("Route Configuration")]
        [Tooltip("Sequential list of checkpoints along the designated training route")]
        [SerializeField] private List<Checkpoint> checkpoints = new List<Checkpoint>();

        [Tooltip("Final destination trigger collider")]
        [SerializeField] private Collider destinationTrigger;

        [Header("Vehicle Reference")]
        [SerializeField] private Transform playerTransform;

        public int CurrentCheckpointIndex { get; private set; } = 0;
        public int TotalCheckpoints => checkpoints.Count;
        public bool IsDestinationReached { get; private set; } = false;

        // Events
        public event Action<int, int> OnCheckpointPassed; // current, total
        public event Action OnDestinationReached;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Register listeners for all checkpoints
            for (int i = 0; i < checkpoints.Count; i++)
            {
                if (checkpoints[i] != null)
                {
                    checkpoints[i].OnVehicleEntered += HandleCheckpointEntered;
                    checkpoints[i].SetPassed(false);
                }
            }
        }

        private void OnDestroy()
        {
            for (int i = 0; i < checkpoints.Count; i++)
            {
                if (checkpoints[i] != null)
                {
                    checkpoints[i].OnVehicleEntered -= HandleCheckpointEntered;
                }
            }
        }

        private void HandleCheckpointEntered(Checkpoint checkpoint, GameObject vehicle)
        {
            // Verify vehicle hit the current expected checkpoint in sequence
            if (checkpoint.CheckpointIndex == CurrentCheckpointIndex)
            {
                checkpoint.SetPassed(true);
                CurrentCheckpointIndex++;

                OnCheckpointPassed?.Invoke(CurrentCheckpointIndex, TotalCheckpoints);

                if (CurrentCheckpointIndex >= TotalCheckpoints)
                {
                    Debug.Log("All checkpoints completed! Proceed to Destination zone.");
                }
            }
        }

        public void NotifyDestinationEntered()
        {
            if (!IsDestinationReached)
            {
                IsDestinationReached = true;
                OnDestinationReached?.Invoke();
                Debug.Log("Destination Successfully Reached!");
            }
        }

        public float GetDistanceToNextCheckpoint()
        {
            if (playerTransform == null) return 0f;

            if (CurrentCheckpointIndex < checkpoints.Count && checkpoints[CurrentCheckpointIndex] != null)
            {
                return Vector3.Distance(playerTransform.position, checkpoints[CurrentCheckpointIndex].transform.position);
            }

            if (destinationTrigger != null)
            {
                return Vector3.Distance(playerTransform.position, destinationTrigger.transform.position);
            }

            return 0f;
        }
    }
}`
  },
  {
    id: 'traffic-signal-gantry',
    name: 'TrafficSignalGantry.cs',
    filePath: 'Assets/Scripts/Environment/TrafficSignalGantry.cs',
    summary: 'Physical traffic light structure with 3-aspect emissive lenses (Red, Amber, Green) and automatic state transitions.',
    inspectorFields: [
      { name: 'redLightMesh', type: 'Renderer', defaultValue: 'Lens_Red (Renderer)', description: 'Red lens renderer with emissive material' },
      { name: 'yellowLightMesh', type: 'Renderer', defaultValue: 'Lens_Yellow (Renderer)', description: 'Amber/Yellow lens renderer' },
      { name: 'greenLightMesh', type: 'Renderer', defaultValue: 'Lens_Green (Renderer)', description: 'Green lens renderer' },
      { name: 'greenDuration', type: 'float', defaultValue: '12f', description: 'Seconds signal remains green' },
      { name: 'yellowDuration', type: 'float', defaultValue: '3.5f', description: 'Seconds signal remains yellow' },
      { name: 'redDuration', type: 'float', defaultValue: '10f', description: 'Seconds signal remains red' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Environment
{
    public enum SignalLightState
    {
        Red,
        Yellow,
        Green
    }

    /// <summary>
    /// Physical traffic signal gantry controlling 3-aspect illuminated lenses.
    /// Provides visual signals in Phase 2, laying foundation for Phase 3 red-light violation detection.
    /// </summary>
    public class TrafficSignalGantry : MonoBehaviour
    {
        [Header("Physical Lens Meshes")]
        [SerializeField] private Renderer redLens;
        [SerializeField] private Renderer yellowLens;
        [SerializeField] private Renderer greenLens;

        [Header("Timing Cycles (Seconds)")]
        [SerializeField] private float greenDuration = 12f;
        [SerializeField] private float yellowDuration = 3.5f;
        [SerializeField] private float redDuration = 10f;

        [Header("State")]
        [SerializeField] private SignalLightState initialLight = SignalLightState.Green;

        public SignalLightState CurrentLight { get; private set; }

        private float stateTimer = 0f;

        // Colors
        private Color redOn = new Color(1f, 0.1f, 0.1f) * 2.5f;
        private Color redOff = new Color(0.2f, 0.05f, 0.05f);

        private Color yellowOn = new Color(1f, 0.8f, 0.1f) * 2.5f;
        private Color yellowOff = new Color(0.2f, 0.15f, 0.05f);

        private Color greenOn = new Color(0.1f, 1f, 0.3f) * 2.5f;
        private Color greenOff = new Color(0.05f, 0.2f, 0.08f);

        private void Start()
        {
            SetLight(initialLight);
        }

        private void Update()
        {
            stateTimer += Time.deltaTime;

            switch (CurrentLight)
            {
                case SignalLightState.Green:
                    if (stateTimer >= greenDuration)
                    {
                        SetLight(SignalLightState.Yellow);
                    }
                    break;

                case SignalLightState.Yellow:
                    if (stateTimer >= yellowDuration)
                    {
                        SetLight(SignalLightState.Red);
                    }
                    break;

                case SignalLightState.Red:
                    if (stateTimer >= redDuration)
                    {
                        SetLight(SignalLightState.Green);
                    }
                    break;
            }
        }

        public void SetLight(SignalLightState newLight)
        {
            CurrentLight = newLight;
            stateTimer = 0f;

            if (redLens != null)
                redLens.material.SetColor("_EmissionColor", newLight == SignalLightState.Red ? redOn : redOff);

            if (yellowLens != null)
                yellowLens.material.SetColor("_EmissionColor", newLight == SignalLightState.Yellow ? yellowOn : yellowOff);

            if (greenLens != null)
                greenLens.material.SetColor("_EmissionColor", newLight == SignalLightState.Green ? greenOn : greenOff);
        }
    }
}`
  },
  {
    id: 'route-hud',
    name: 'RouteHUD.cs',
    filePath: 'Assets/Scripts/UI/RouteHUD.cs',
    summary: 'Heads-Up Display module showing active camera view, current checkpoint progress, and distance to next checkpoint/destination.',
    inspectorFields: [
      { name: 'cameraModeText', type: 'Text', defaultValue: 'Text_CameraMode (UI Text)', description: 'Displays "[C] Camera: 3rd-Person Chase"' },
      { name: 'checkpointProgressText', type: 'Text', defaultValue: 'Text_CheckpointProgress', description: 'Displays "Checkpoint: 2 / 5"' },
      { name: 'distanceNextText', type: 'Text', defaultValue: 'Text_DistanceNext', description: 'Displays "Next Point: 140m"' }
    ],
    code: `using UnityEngine;
using UnityEngine.UI;

namespace Simulator.UI
{
    /// <summary>
    /// Displays navigation route guidance, checkpoint progress, and camera view mode on HUD.
    /// Modularly extends Phase 1 SpeedometerUI without modifying existing code.
    /// </summary>
    public class RouteHUD : MonoBehaviour
    {
        [Header("UI Text References")]
        [SerializeField] private Text cameraModeText;
        [SerializeField] private Text checkpointProgressText;
        [SerializeField] private Text distanceNextText;

        private void Start()
        {
            if (CameraControl.CameraManager.Instance != null)
            {
                CameraControl.CameraManager.Instance.OnCameraChanged += HandleCameraChanged;
                UpdateCameraDisplay(CameraControl.CameraManager.Instance.CurrentMode);
            }

            if (Environment.CheckpointManager.Instance != null)
            {
                Environment.CheckpointManager.Instance.OnCheckpointPassed += HandleCheckpointPassed;
                Environment.CheckpointManager.Instance.OnDestinationReached += HandleDestinationReached;
            }
        }

        private void OnDestroy()
        {
            if (CameraControl.CameraManager.Instance != null)
            {
                CameraControl.CameraManager.Instance.OnCameraChanged -= HandleCameraChanged;
            }

            if (Environment.CheckpointManager.Instance != null)
            {
                Environment.CheckpointManager.Instance.OnCheckpointPassed -= HandleCheckpointPassed;
                Environment.CheckpointManager.Instance.OnDestinationReached -= HandleDestinationReached;
            }
        }

        private void Update()
        {
            // Update distance readout dynamically
            if (Environment.CheckpointManager.Instance != null && distanceNextText != null)
            {
                float distance = Environment.CheckpointManager.Instance.GetDistanceToNextCheckpoint();
                int distanceInt = Mathf.RoundToInt(distance);

                if (Environment.CheckpointManager.Instance.IsDestinationReached)
                {
                    distanceNextText.text = "DESTINATION REACHED";
                    distanceNextText.color = Color.green;
                }
                else
                {
                    distanceNextText.text = $"Next Target: {distanceInt}m";
                }
            }
        }

        private void HandleCameraChanged(CameraControl.CameraViewMode newMode)
        {
            UpdateCameraDisplay(newMode);
        }

        private void UpdateCameraDisplay(CameraControl.CameraViewMode mode)
        {
            if (cameraModeText != null && CameraControl.CameraManager.Instance != null)
            {
                cameraModeText.text = $"[C] View: {CameraControl.CameraManager.Instance.GetCurrentModeDisplayName()}";
            }
        }

        private void HandleCheckpointPassed(int current, int total)
        {
            if (checkpointProgressText != null)
            {
                checkpointProgressText.text = $"Route Checkpoints: {current} / {total}";
            }
        }

        private void HandleDestinationReached()
        {
            if (checkpointProgressText != null)
            {
                checkpointProgressText.text = "MISSION COMPLETE: Destination Reached";
                checkpointProgressText.color = Color.green;
            }
        }
    }
}`
  },
  {
    id: 'speed-limit-zone',
    name: 'SpeedLimitZone.cs',
    filePath: 'Assets/Scripts/Violations/SpeedLimitZone.cs',
    summary: 'Trigger volume defining local road speed limit. Continuously checks player vehicle speed and fires overspeed warnings & violations.',
    inspectorFields: [
      { name: 'speedLimitKmh', type: 'float', defaultValue: '50.0f', description: 'Permitted maximum speed in this zone (km/h)' },
      { name: 'speedToleranceKmh', type: 'float', defaultValue: '3.0f', description: 'Grace buffer before penalty triggers (km/h)' },
      { name: 'graceDurationSeconds', type: 'float', defaultValue: '2.0f', description: 'Seconds vehicle can momentarily exceed limit before penalty event' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Violations
{
    /// <summary>
    /// Trigger volume defining a speed zone.
    /// Evaluates if passing vehicles exceed the speed limit beyond a tolerance duration.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class SpeedLimitZone : MonoBehaviour
    {
        [Header("Zone Configuration")]
        [Tooltip("Posted speed limit for this road segment (km/h)")]
        [SerializeField] private float speedLimitKmh = 50f;

        [Tooltip("Allowed buffer before violation triggers (km/h)")]
        [SerializeField] private float speedToleranceKmh = 3f;

        [Tooltip("Seconds vehicle can sustain excess speed before penalty")]
        [SerializeField] private float graceDurationSeconds = 2.0f;

        public float SpeedLimitKmh => speedLimitKmh;

        private Vehicle.CarController activeVehicle;
        private float overspeedTimer = 0f;
        private bool hasLoggedViolationInCurrentBurst = false;

        public static event Action<float, float> OnZoneEntered; // speedLimit, currentSpeed
        public static event Action OnZoneExited;
        public static event Action<float, float> OnOverspeedTriggered; // limit, recordedSpeed

        private void Awake()
        {
            Collider col = GetComponent<Collider>();
            col.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.CompareTag("Player") || other.transform.root.CompareTag("Player"))
            {
                activeVehicle = other.transform.root.GetComponent<Vehicle.CarController>();
                if (activeVehicle != null)
                {
                    OnZoneEntered?.Invoke(speedLimitKmh, activeVehicle.CurrentSpeedKmh);
                    overspeedTimer = 0f;
                    hasLoggedViolationInCurrentBurst = false;
                }
            }
        }

        private void OnTriggerStay(Collider other)
        {
            if (activeVehicle == null) return;

            float currentSpeed = activeVehicle.CurrentSpeedKmh;
            float threshold = speedLimitKmh + speedToleranceKmh;

            if (currentSpeed > threshold)
            {
                overspeedTimer += Time.deltaTime;
                if (overspeedTimer >= graceDurationSeconds && !hasLoggedViolationInCurrentBurst)
                {
                    hasLoggedViolationInCurrentBurst = true;
                    OnOverspeedTriggered?.Invoke(speedLimitKmh, currentSpeed);
                    Debug.LogWarning($"[SpeedLimitZone] Overspeeding detected! Speed: {currentSpeed:F1} km/h in {speedLimitKmh} km/h zone.");
                }
            }
            else
            {
                // Reset timer when driver drops back under limit
                overspeedTimer = Mathf.Max(0f, overspeedTimer - Time.deltaTime * 1.5f);
                if (overspeedTimer <= 0.1f)
                {
                    hasLoggedViolationInCurrentBurst = false;
                }
            }
        }

        private void OnTriggerExit(Collider other)
        {
            if (other.CompareTag("Player") || other.transform.root.CompareTag("Player"))
            {
                activeVehicle = null;
                overspeedTimer = 0f;
                hasLoggedViolationInCurrentBurst = false;
                OnZoneExited?.Invoke();
            }
        }
    }
}`
  },
  {
    id: 'traffic-signal-trigger',
    name: 'TrafficSignalTrigger.cs',
    filePath: 'Assets/Scripts/Violations/TrafficSignalTrigger.cs',
    summary: 'Sensor boundary positioned at intersection stop-line. Queries parent TrafficSignalGantry to detect unauthorized red-light crossings.',
    inspectorFields: [
      { name: 'signalGantry', type: 'TrafficSignalGantry', defaultValue: 'TrafficSignal_North (Reference)', description: 'Associated physical traffic signal gantry' },
      { name: 'stopLineThresholdDistance', type: 'float', defaultValue: '2.5f', description: 'Trigger width spanning stop line' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Violations
{
    /// <summary>
    /// Intersection stop-line trigger sensor.
    /// Detects when a vehicle crosses the junction boundary while the signal is Red.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class TrafficSignalTrigger : MonoBehaviour
    {
        [Header("Signal Association")]
        [Tooltip("The traffic light gantry governing this intersection entrance")]
        [SerializeField] private Environment.TrafficSignalGantry signalGantry;

        public static event Action OnRedLightViolationTriggered;

        private void Awake()
        {
            Collider col = GetComponent<Collider>();
            col.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            // Detect if vehicle enters while light is Red
            if (other.CompareTag("Player") || other.transform.root.CompareTag("Player"))
            {
                if (signalGantry != null && signalGantry.CurrentLight == Environment.SignalLightState.Red)
                {
                    OnRedLightViolationTriggered?.Invoke();
                    Debug.LogWarning("[TrafficSignalTrigger] RED LIGHT VIOLATION! Vehicle crossed stop line on Red.");
                }
            }
        }
    }
}`
  },
  {
    id: 'collision-monitor',
    name: 'CollisionMonitor.cs',
    filePath: 'Assets/Scripts/Violations/CollisionMonitor.cs',
    summary: 'Attached to Player vehicle. Listens for physical impact with obstacles, barriers, or other vehicles with debouncing.',
    inspectorFields: [
      { name: 'minimumImpactVelocity', type: 'float', defaultValue: '1.2f', description: 'Minimum relative velocity required to count as collision (m/s)' },
      { name: 'collisionDebounceSeconds', type: 'float', defaultValue: '2.0f', description: 'Time before registering another collision with same obstacle' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Violations
{
    /// <summary>
    /// Monitors Rigidbody physical collisions on the player car.
    /// Filters out minor suspension road scrapes and triggers violation penalties on real impacts.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class CollisionMonitor : MonoBehaviour
    {
        [Header("Collision Sensitivity")]
        [Tooltip("Minimum impact relative velocity (m/s) to register collision")]
        [SerializeField] private float minimumImpactVelocity = 1.2f;

        [Tooltip("Debounce duration in seconds to prevent multiple penalties for single crash")]
        [SerializeField] private float collisionDebounceSeconds = 2.0f;

        public static event Action<string, float> OnCollisionDetected; // obstacleName, impactForce

        private float lastCollisionTime = -10f;

        private void OnCollisionEnter(Collision collision)
        {
            // Ignore ground/road plane contacts (road is standard driving surface)
            if (collision.gameObject.name.Contains("Road") || collision.gameObject.name.Contains("Ground"))
            {
                return;
            }

            if (Time.time - lastCollisionTime < collisionDebounceSeconds)
            {
                return;
            }

            float impactSpeed = collision.relativeVelocity.magnitude;
            if (impactSpeed >= minimumImpactVelocity)
            {
                lastCollisionTime = Time.time;
                string hitName = collision.gameObject.name;
                OnCollisionDetected?.Invoke(hitName, impactSpeed);
                Debug.LogWarning($"[CollisionMonitor] IMPACT DETECTED with {hitName}! Velocity: {impactSpeed:F1} m/s");
            }
        }
    }
}`
  },
  {
    id: 'lane-monitor',
    name: 'LaneMonitor.cs',
    filePath: 'Assets/Scripts/Violations/LaneMonitor.cs',
    summary: 'Tracks lateral position relative to road center divider to detect sustained wrong-way driving in oncoming traffic lanes.',
    inspectorFields: [
      { name: 'wrongLaneSustainedDuration', type: 'float', defaultValue: '1.5f', description: 'Seconds car must remain in opposite lane to trigger penalty' },
      { name: 'roadCenterDividerX', type: 'float', defaultValue: '0.0f', description: 'X position of yellow/white center divider on main avenue' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Violations
{
    /// <summary>
    /// Evaluates vehicle lateral position relative to road lane boundaries.
    /// Flags when driver operates in oncoming opposite lane for sustained periods.
    /// </summary>
    public class LaneMonitor : MonoBehaviour
    {
        [Header("Lane Boundaries")]
        [Tooltip("Threshold duration in seconds of wrong-lane driving before penalty")]
        [SerializeField] private float wrongLaneSustainedDuration = 1.5f;

        [Header("Vehicle Reference")]
        [SerializeField] private Vehicle.CarController playerCar;

        public static event Action OnWrongLaneViolationTriggered;

        private float wrongLaneTimer = 0f;
        private bool isPenaltyLogged = false;

        private void Update()
        {
            if (playerCar == null) return;

            // In our right-hand drive road setup:
            // Forward lane is X > 0 (right side). Oncoming traffic is X < 0 (left side).
            // When moving forward (heading north) and positioned on left side of center divider:
            Vector3 pos = playerCar.transform.position;
            float headingDot = Vector3.Dot(playerCar.transform.forward, Vector3.forward);

            // Driving north (Z increasing) on the left side (X < -1.0)
            bool isDrivingOncoming = (headingDot > 0.5f && pos.x < -1.2f && pos.z < 85f);

            if (isDrivingOncoming && playerCar.CurrentSpeedKmh > 5.0f)
            {
                wrongLaneTimer += Time.deltaTime;
                if (wrongLaneTimer >= wrongLaneSustainedDuration && !isPenaltyLogged)
                {
                    isPenaltyLogged = true;
                    OnWrongLaneViolationTriggered?.Invoke();
                    Debug.LogWarning("[LaneMonitor] WRONG LANE VIOLATION! Driving in oncoming traffic lane.");
                }
            }
            else
            {
                wrongLaneTimer = Mathf.Max(0f, wrongLaneTimer - Time.deltaTime * 2.0f);
                if (wrongLaneTimer <= 0.1f)
                {
                    isPenaltyLogged = false;
                }
            }
        }
    }
}`
  },
  {
    id: 'violation-manager',
    name: 'ViolationManager.cs',
    filePath: 'Assets/Scripts/Violations/ViolationManager.cs',
    summary: 'Central rule violation evaluator. Aggregates sensor events, deducts penalty points from base 100 score, and tracks lifetime counts.',
    inspectorFields: [
      { name: 'collisionPenalty', type: 'int', defaultValue: '20', description: 'Points deducted per collision (-20)' },
      { name: 'redLightPenalty', type: 'int', defaultValue: '15', description: 'Points deducted per red light ran (-15)' },
      { name: 'wrongLanePenalty', type: 'int', defaultValue: '10', description: 'Points deducted per wrong-lane incident (-10)' },
      { name: 'overspeedPenalty', type: 'int', defaultValue: '5', description: 'Points deducted per sustained overspeed event (-5)' },
      { name: 'missedCheckpointPenalty', type: 'int', defaultValue: '5', description: 'Points deducted if checkpoint skipped (-5)' },
      { name: 'hardBrakingPenalty', type: 'int', defaultValue: '3', description: 'Points deducted for harsh abrupt braking (-3)' }
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simulator.Violations
{
    public enum ViolationType
    {
        Collision,
        RedLight,
        WrongLane,
        Overspeed,
        MissedCheckpoint,
        HardBraking
    }

    [System.Serializable]
    public struct ViolationRecord
    {
        public ViolationType type;
        public float timestamp;
        public int pointsDeducted;
        public string description;
    }

    /// <summary>
    /// Central traffic rule and driver violation manager.
    /// Listens to all sensor monitors, maintains the 100-point driving score, and broadcasts events.
    /// </summary>
    public class ViolationManager : MonoBehaviour
    {
        public static ViolationManager Instance { get; private set; }

        [Header("Configurable Penalty Structure")]
        [SerializeField] private int collisionPenalty = 20;
        [SerializeField] private int redLightPenalty = 15;
        [SerializeField] private int wrongLanePenalty = 10;
        [SerializeField] private int overspeedPenalty = 5;
        [SerializeField] private int missedCheckpointPenalty = 5;
        [SerializeField] private int hardBrakingPenalty = 3;

        [Header("Initial Baseline")]
        [SerializeField] private int startingScore = 100;

        public int CurrentScore { get; private set; } = 100;

        // Lifetime counters
        public int CollisionCount { get; private set; }
        public int RedLightCount { get; private set; }
        public int WrongLaneCount { get; private set; }
        public int OverspeedCount { get; private set; }
        public int HardBrakingCount { get; private set; }

        public List<ViolationRecord> ViolationHistory { get; private set; } = new List<ViolationRecord>();

        // Events
        public event Action<ViolationRecord, int> OnViolationOccurred; // record, remainingScore

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            CurrentScore = startingScore;
        }

        private void OnEnable()
        {
            CollisionMonitor.OnCollisionDetected += HandleCollision;
            TrafficSignalTrigger.OnRedLightViolationTriggered += HandleRedLight;
            SpeedLimitZone.OnOverspeedTriggered += HandleOverspeed;
            LaneMonitor.OnWrongLaneViolationTriggered += HandleWrongLane;
        }

        private void OnDisable()
        {
            CollisionMonitor.OnCollisionDetected -= HandleCollision;
            TrafficSignalTrigger.OnRedLightViolationTriggered -= HandleRedLight;
            SpeedLimitZone.OnOverspeedTriggered -= HandleOverspeed;
            LaneMonitor.OnWrongLaneViolationTriggered -= HandleWrongLane;
        }

        private void HandleCollision(string obstacle, float velocity)
        {
            CollisionCount++;
            ApplyPenalty(ViolationType.Collision, collisionPenalty, $"Impact with {obstacle} (-{collisionPenalty} pts)");
        }

        private void HandleRedLight()
        {
            RedLightCount++;
            ApplyPenalty(ViolationType.RedLight, redLightPenalty, $"Signal Violation: Crossed on Red Light (-{redLightPenalty} pts)");
        }

        private void HandleOverspeed(float limit, float speed)
        {
            OverspeedCount++;
            ApplyPenalty(ViolationType.Overspeed, overspeedPenalty, $"Overspeeding: {speed:F0} km/h in {limit:F0} zone (-{overspeedPenalty} pts)");
        }

        private void HandleWrongLane()
        {
            WrongLaneCount++;
            ApplyPenalty(ViolationType.WrongLane, wrongLanePenalty, $"Lane Discipline: Driving in Oncoming Lane (-{wrongLanePenalty} pts)");
        }

        public void RegisterHardBraking()
        {
            HardBrakingCount++;
            ApplyPenalty(ViolationType.HardBraking, hardBrakingPenalty, $"Harsh Braking Event (-{hardBrakingPenalty} pts)");
        }

        private void ApplyPenalty(ViolationType type, int deduction, string desc)
        {
            CurrentScore = Mathf.Max(0, CurrentScore - deduction);

            ViolationRecord record = new ViolationRecord
            {
                type = type,
                timestamp = Time.time,
                pointsDeducted = deduction,
                description = desc
            };

            ViolationHistory.Add(record);
            OnViolationOccurred?.Invoke(record, CurrentScore);
            Debug.Log($"[ViolationManager] {desc} | Score now: {CurrentScore}/100");
        }
    }
}`
  },
  {
    id: 'violation-hud',
    name: 'ViolationHUD.cs',
    filePath: 'Assets/Scripts/UI/ViolationHUD.cs',
    summary: 'Heads-Up Display widget rendering real-time violation popup banners and the live driver score counter (Score: XX / 100).',
    inspectorFields: [
      { name: 'scoreText', type: 'Text', defaultValue: 'Text_LiveScore (Text)', description: 'Displays "Driving Score: 95 / 100"' },
      { name: 'alertBannerPanel', type: 'GameObject', defaultValue: 'Panel_ViolationAlert', description: 'Animated banner flashing on violation' },
      { name: 'alertMessageText', type: 'Text', defaultValue: 'Text_AlertMessage', description: 'Text description of penalty' }
    ],
    code: `using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Simulator.UI
{
    /// <summary>
    /// Renders real-time violation alerts and driving score in the UI.
    /// Shows color-coded score status (Green: Excellent, Blue: Good, Amber: Needs Improvement, Red: Unsafe).
    /// </summary>
    public class ViolationHUD : MonoBehaviour
    {
        [Header("Score Display")]
        [SerializeField] private Text scoreText;

        [Header("Violation Alert Banner")]
        [SerializeField] private GameObject alertBannerPanel;
        [SerializeField] private Text alertMessageText;
        [SerializeField] private float bannerDisplaySeconds = 3.5f;

        private Coroutine alertCoroutine;

        private void Start()
        {
            if (alertBannerPanel != null)
            {
                alertBannerPanel.SetActive(false);
            }

            if (Violations.ViolationManager.Instance != null)
            {
                Violations.ViolationManager.Instance.OnViolationOccurred += HandleViolation;
                UpdateScoreDisplay(Violations.ViolationManager.Instance.CurrentScore);
            }
        }

        private void OnDestroy()
        {
            if (Violations.ViolationManager.Instance != null)
            {
                Violations.ViolationManager.Instance.OnViolationOccurred -= HandleViolation;
            }
        }

        private void HandleViolation(Violations.ViolationRecord record, int remainingScore)
        {
            UpdateScoreDisplay(remainingScore);

            if (alertCoroutine != null)
            {
                StopCoroutine(alertCoroutine);
            }
            alertCoroutine = StartCoroutine(ShowBannerRoutine(record.description));
        }

        private void UpdateScoreDisplay(int score)
        {
            if (scoreText == null) return;

            scoreText.text = $"Score: {score} / 100";

            if (score >= 90)
                scoreText.color = new Color(0.1f, 0.9f, 0.4f); // Excellent (Green)
            else if (score >= 75)
                scoreText.color = new Color(0.2f, 0.7f, 1f);  // Good (Sky Blue)
            else if (score >= 60)
                scoreText.color = new Color(1f, 0.7f, 0.2f);  // Needs Improvement (Amber)
            else
                scoreText.color = new Color(1f, 0.25f, 0.25f); // Unsafe (Red)
        }

        private IEnumerator ShowBannerRoutine(string message)
        {
            if (alertBannerPanel != null && alertMessageText != null)
            {
                alertMessageText.text = $"⚠️ {message.ToUpper()}";
                alertBannerPanel.SetActive(true);

                yield return new WaitForSeconds(bannerDisplaySeconds);

                alertBannerPanel.SetActive(false);
            }
        }
    }
}`
  },
  {
    id: 'scenario-manager',
    name: 'ScenarioManager.cs',
    filePath: 'Assets/Scripts/Scenarios/ScenarioManager.cs',
    summary: 'Controls training scenario presets (City, Highway, Rain, Night), coordinating environmental lighting, weather, traffic density, and speed rules.',
    inspectorFields: [
      { name: 'currentScenario', type: 'ScenarioType', defaultValue: 'ScenarioType.City', description: 'Active training scenario preset' },
      { name: 'weatherManager', type: 'WeatherManager', defaultValue: 'WeatherManager reference', description: 'Coordinates rain, fog, and road friction' },
      { name: 'sunLight', type: 'Light', defaultValue: 'Directional Light', description: 'Main directional sun light' },
      { name: 'trafficContainer', type: 'GameObject', defaultValue: 'TrafficVehicles container', description: 'Parent holding AI traffic vehicles' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Scenarios
{
    public enum ScenarioType
    {
        City,
        Highway,
        Rain,
        Night
    }

    /// <summary>
    /// Coordinates driver-training scenario presets (City, Highway, Rain, Night).
    /// Dynamically applies lighting, weather conditions, traffic vehicle spawns, and speed limits.
    /// </summary>
    public class ScenarioManager : MonoBehaviour
    {
        public static ScenarioManager Instance { get; private set; }

        [Header("Active Scenario")]
        [SerializeField] private ScenarioType activeScenario = ScenarioType.City;

        [Header("Subsystem References")]
        [SerializeField] private Environment.WeatherManager weatherManager;
        [SerializeField] private Light sunLight;
        [SerializeField] private GameObject trafficContainer;
        [SerializeField] private GameObject pedestriansContainer;

        [Header("Lighting Presets")]
        [SerializeField] private Color daySunColor = new Color(1f, 0.96f, 0.88f);
        [SerializeField] private Color rainSunColor = new Color(0.5f, 0.55f, 0.6f);
        [SerializeField] private Color nightSunColor = new Color(0.05f, 0.08f, 0.15f);

        public ScenarioType ActiveScenario => activeScenario;

        public event Action<ScenarioType> OnScenarioChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            ApplyScenario(activeScenario);
        }

        public void SetScenario(ScenarioType scenario)
        {
            activeScenario = scenario;
            ApplyScenario(scenario);
            OnScenarioChanged?.Invoke(scenario);
        }

        private void ApplyScenario(ScenarioType scenario)
        {
            Debug.Log($"[ScenarioManager] Loading Scenario: {scenario}");

            switch (scenario)
            {
                case ScenarioType.City:
                    ConfigureLighting(daySunColor, 1.1f, 50f, -30f);
                    RenderSettings.fog = false;
                    if (weatherManager != null) weatherManager.SetRainActive(false);
                    SetObjectsActive(trafficContainer, true);
                    SetObjectsActive(pedestriansContainer, true);
                    break;

                case ScenarioType.Highway:
                    ConfigureLighting(daySunColor, 1.25f, 45f, -20f);
                    RenderSettings.fog = true;
                    RenderSettings.fogMode = FogMode.Exponential;
                    RenderSettings.fogDensity = 0.003f;
                    RenderSettings.fogColor = new Color(0.7f, 0.8f, 0.9f);
                    if (weatherManager != null) weatherManager.SetRainActive(false);
                    SetObjectsActive(trafficContainer, true);
                    SetObjectsActive(pedestriansContainer, false);
                    break;

                case ScenarioType.Rain:
                    ConfigureLighting(rainSunColor, 0.4f, 60f, -40f);
                    RenderSettings.fog = true;
                    RenderSettings.fogMode = FogMode.Exponential;
                    RenderSettings.fogDensity = 0.025f;
                    RenderSettings.fogColor = new Color(0.45f, 0.48f, 0.52f);
                    if (weatherManager != null) weatherManager.SetRainActive(true);
                    SetObjectsActive(trafficContainer, true);
                    SetObjectsActive(pedestriansContainer, true);
                    break;

                case ScenarioType.Night:
                    ConfigureLighting(nightSunColor, 0.08f, 15f, -30f);
                    RenderSettings.fog = true;
                    RenderSettings.fogMode = FogMode.Exponential;
                    RenderSettings.fogDensity = 0.015f;
                    RenderSettings.fogColor = new Color(0.02f, 0.03f, 0.06f);
                    if (weatherManager != null) weatherManager.SetRainActive(false);
                    SetObjectsActive(trafficContainer, true);
                    SetObjectsActive(pedestriansContainer, true);
                    break;
            }
        }

        private void ConfigureLighting(Color color, float intensity, float rotX, float rotY)
        {
            if (sunLight != null)
            {
                sunLight.color = color;
                sunLight.intensity = intensity;
                sunLight.transform.rotation = Quaternion.Euler(rotX, rotY, 0f);
            }
        }

        private void SetObjectsActive(GameObject target, bool active)
        {
            if (target != null)
            {
                target.SetActive(active);
            }
        }
    }
}`
  },
  {
    id: 'weather-manager',
    name: 'WeatherManager.cs',
    filePath: 'Assets/Scripts/Environment/WeatherManager.cs',
    summary: 'Simulates rain precipitation particles and dynamically modifies WheelCollider friction curves to realistically reduce tire grip on wet asphalt.',
    inspectorFields: [
      { name: 'rainParticleSystem', type: 'ParticleSystem', defaultValue: 'RainParticleSystem', description: 'Overhead camera-following rain particle system' },
      { name: 'wetFrictionMultiplier', type: 'float', defaultValue: '0.55f', description: 'Tire stiffness multiplier when raining (0.55 = 45% grip loss)' },
      { name: 'playerCar', type: 'CarController', defaultValue: 'Car_Player', description: 'Reference to player vehicle' }
    ],
    code: `using UnityEngine;

namespace Simulator.Environment
{
    /// <summary>
    /// Manages weather effects including rain particles and wet road physics.
    /// Modifies WheelCollider friction curves to simulate hydroplaning and reduced braking grip.
    /// </summary>
    public class WeatherManager : MonoBehaviour
    {
        [Header("Precipitation Particles")]
        [SerializeField] private ParticleSystem rainParticleSystem;

        [Header("Friction & Tire Grip Modification")]
        [Tooltip("Grip friction curve stiffness multiplier during rain (1.0 = normal, 0.55 = wet asphalt)")]
        [Range(0.2f, 1.0f)]
        [SerializeField] private float wetFrictionMultiplier = 0.55f;

        [Header("Vehicle Reference")]
        [SerializeField] private Vehicle.CarController playerCar;
        [SerializeField] private WheelCollider[] playerWheelColliders;

        public bool IsRaining { get; private set; } = false;

        private float defaultForwardStiffness = 1.0f;
        private float defaultSidewaysStiffness = 1.0f;

        private void Start()
        {
            if (playerWheelColliders == null || playerWheelColliders.Length == 0)
            {
                if (playerCar != null)
                {
                    playerWheelColliders = playerCar.GetComponentsInChildren<WheelCollider>();
                }
            }

            if (playerWheelColliders != null && playerWheelColliders.Length > 0)
            {
                defaultForwardStiffness = playerWheelColliders[0].forwardFriction.stiffness;
                defaultSidewaysStiffness = playerWheelColliders[0].sidewaysFriction.stiffness;
            }
        }

        public void SetRainActive(bool active)
        {
            IsRaining = active;

            if (rainParticleSystem != null)
            {
                if (active) rainParticleSystem.Play();
                else rainParticleSystem.Stop();
            }

            ApplyFrictionCurves(active ? wetFrictionMultiplier : 1.0f);
        }

        private void ApplyFrictionCurves(float multiplier)
        {
            if (playerWheelColliders == null) return;

            foreach (var wheel in playerWheelColliders)
            {
                if (wheel == null) continue;

                WheelFrictionCurve forward = wheel.forwardFriction;
                forward.stiffness = defaultForwardStiffness * multiplier;
                wheel.forwardFriction = forward;

                WheelFrictionCurve sideways = wheel.sidewaysFriction;
                sideways.stiffness = defaultSidewaysStiffness * multiplier;
                wheel.sidewaysFriction = sideways;
            }

            Debug.Log($"[WeatherManager] Tire grip stiffness set to: {multiplier:F2} (Rain: {IsRaining})");
        }
    }
}`
  },
  {
    id: 'traffic-vehicle-controller',
    name: 'TrafficVehicleController.cs',
    filePath: 'Assets/Scripts/Traffic/TrafficVehicleController.cs',
    summary: 'Autonomous AI vehicle navigating designated road paths with obstacle raycast detection, red-light yielding, and physical collision registration.',
    inspectorFields: [
      { name: 'speedKmh', type: 'float', defaultValue: '35f', description: 'Cruise speed for traffic car (km/h)' },
      { name: 'waypoints', type: 'Transform[]', defaultValue: 'Array of waypoint transforms', description: 'Ordered navigation path' },
      { name: 'forwardSensorDistance', type: 'float', defaultValue: '12f', description: 'Raycast distance to detect obstacles ahead and brake' }
    ],
    code: `using UnityEngine;

namespace Simulator.Traffic
{
    /// <summary>
    /// Kinematic AI traffic vehicle.
    /// Traverses route waypoints, detects vehicles ahead via forward raycasts to stop cleanly,
    /// and acts as a dynamic hazard for collision detection.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class TrafficVehicleController : MonoBehaviour
    {
        [Header("Locomotion")]
        [SerializeField] private float cruiseSpeedKmh = 35f;
        [SerializeField] private float turnSpeed = 3.5f;

        [Header("Navigation Path")]
        [SerializeField] private Transform[] waypoints;
        [SerializeField] private float waypointThreshold = 2.0f;
        [SerializeField] private bool loopWaypoints = true;

        [Header("Obstacle Avoidance")]
        [SerializeField] private float forwardSensorDistance = 10f;
        [SerializeField] private LayerMask obstacleLayers;

        private Rigidbody rb;
        private int currentWaypointIndex = 0;
        private bool isYielding = false;

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            rb.isKinematic = true; // Kinematic movement for smooth AI traffic predictability
            gameObject.tag = "Obstacle"; // Tagged so CollisionMonitor catches impacts
        }

        private void Update()
        {
            if (waypoints == null || waypoints.Length == 0) return;

            CheckForwardObstacles();

            if (!isYielding)
            {
                MoveAlongPath();
            }
        }

        private void CheckForwardObstacles()
        {
            Vector3 origin = transform.position + Vector3.up * 0.7f;
            Ray ray = new Ray(origin, transform.forward);

            if (Physics.Raycast(ray, out RaycastHit hit, forwardSensorDistance))
            {
                // Yield if another car, player, or pedestrian is ahead
                if (hit.collider.CompareTag("Player") || hit.collider.CompareTag("Obstacle"))
                {
                    isYielding = true;
                    return;
                }
            }

            isYielding = false;
        }

        private void MoveAlongPath()
        {
            Transform target = waypoints[currentWaypointIndex];
            Vector3 direction = (target.position - transform.position);
            direction.y = 0f;

            if (direction.magnitude <= waypointThreshold)
            {
                currentWaypointIndex++;
                if (currentWaypointIndex >= waypoints.Length)
                {
                    if (loopWaypoints) currentWaypointIndex = 0;
                    else return;
                }
                return;
            }

            // Rotate toward waypoint
            Quaternion targetRot = Quaternion.LookRotation(direction.normalized);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, turnSpeed * Time.deltaTime);

            // Translate forward
            float speedMs = (cruiseSpeedKmh / 3.6f);
            transform.position += transform.forward * speedMs * Time.deltaTime;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.red;
            Gizmos.DrawRay(transform.position + Vector3.up * 0.7f, transform.forward * forwardSensorDistance);
        }
    }
}`
  },
  {
    id: 'pedestrian-controller',
    name: 'PedestrianController.cs',
    filePath: 'Assets/Scripts/Traffic/PedestrianController.cs',
    summary: 'Controls animated or kinematic pedestrians crossing roads at crosswalks, stopping at sidewalks and triggering emergency stops if driver encroaches.',
    inspectorFields: [
      { name: 'walkSpeed', type: 'float', defaultValue: '1.4f', description: 'Walking speed across zebra crosswalk (m/s)' },
      { name: 'curbA', type: 'Transform', defaultValue: 'Curb_East', description: 'Left sidewalk waypoint' },
      { name: 'curbB', type: 'Transform', defaultValue: 'Curb_West', description: 'Right sidewalk waypoint' },
      { name: 'pauseAtCurbDuration', type: 'float', defaultValue: '3.0f', description: 'Seconds pedestrian waits before crossing again' }
    ],
    code: `using UnityEngine;

namespace Simulator.Traffic
{
    /// <summary>
    /// Simulates pedestrians crossing at street crosswalks.
    /// Traverses between curb waypoints and acts as a collision obstacle with immediate penalty consequences.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class PedestrianController : MonoBehaviour
    {
        [Header("Crossing Path")]
        [SerializeField] private Transform curbA;
        [SerializeField] private Transform curbB;
        [SerializeField] private float walkSpeed = 1.4f; // Typical human walking speed
        [SerializeField] private float pauseAtCurbDuration = 3.0f;

        private Transform currentTarget;
        private float pauseTimer = 0f;
        private bool isPausing = false;

        private void Awake()
        {
            gameObject.tag = "Obstacle"; // Registered as obstacle for collision detection
            currentTarget = curbA;
        }

        private void Update()
        {
            if (curbA == null || curbB == null) return;

            if (isPausing)
            {
                pauseTimer += Time.deltaTime;
                if (pauseTimer >= pauseAtCurbDuration)
                {
                    isPausing = false;
                    pauseTimer = 0f;
                    currentTarget = (currentTarget == curbA) ? curbB : curbA;
                }
                return;
            }

            Vector3 toTarget = currentTarget.position - transform.position;
            toTarget.y = 0f;

            if (toTarget.magnitude < 0.3f)
            {
                isPausing = true;
                return;
            }

            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(toTarget.normalized), 6f * Time.deltaTime);
            transform.position += transform.forward * walkSpeed * Time.deltaTime;
        }
    }
}`
  },
  {
    id: 'vehicle-headlights',
    name: 'VehicleHeadlights.cs',
    filePath: 'Assets/Scripts/Vehicle/VehicleHeadlights.cs',
    summary: 'Manages player car dual headlight spotlights, high beams, and illuminated emissive lenses, with toggle binding (Key "H") and auto-activation in Night/Rain.',
    inspectorFields: [
      { name: 'leftHeadlight', type: 'Light', defaultValue: 'Spot Light Left', description: 'Spotlight cone for driver side' },
      { name: 'rightHeadlight', type: 'Light', defaultValue: 'Spot Light Right', description: 'Spotlight cone for passenger side' },
      { name: 'toggleKey', type: 'KeyCode', defaultValue: 'KeyCode.H', description: 'Shortcut key to toggle lights' },
      { name: 'headlightLenses', type: 'Renderer[]', defaultValue: 'Lenses renderers', description: 'Meshes with emissive material' }
    ],
    code: `using UnityEngine;

namespace Simulator.Vehicle
{
    /// <summary>
    /// Controls vehicle headlights and tail/brake lamps.
    /// Provides visibility in night and rain scenarios with [H] hotkey toggle.
    /// </summary>
    public class VehicleHeadlights : MonoBehaviour
    {
        [Header("Spotlight Cones")]
        [SerializeField] private Light leftHeadlight;
        [SerializeField] private Light rightHeadlight;

        [Header("Illuminated Lens Meshes")]
        [SerializeField] private Renderer[] headlightLenses;

        [Header("Controls")]
        [SerializeField] private KeyCode toggleKey = KeyCode.H;
        [SerializeField] private bool startOn = false;

        public bool AreHeadlightsOn { get; private set; }

        private Color lensOnColor = new Color(1f, 1f, 0.9f) * 2.0f;
        private Color lensOffColor = new Color(0.2f, 0.2f, 0.2f);

        private void Start()
        {
            SetHeadlights(startOn);
        }

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                ToggleHeadlights();
            }
        }

        public void ToggleHeadlights()
        {
            SetHeadlights(!AreHeadlightsOn);
        }

        public void SetHeadlights(bool on)
        {
            AreHeadlightsOn = on;

            if (leftHeadlight != null) leftHeadlight.enabled = on;
            if (rightHeadlight != null) rightHeadlight.enabled = on;

            if (headlightLenses != null)
            {
                foreach (var lens in headlightLenses)
                {
                    if (lens != null && lens.material != null)
                    {
                        lens.material.SetColor("_EmissionColor", on ? lensOnColor : lensOffColor);
                    }
                }
            }

            Debug.Log($"[VehicleHeadlights] Headlights turned {(on ? "ON" : "OFF")}");
        }
    }
}`
  },
  {
    id: 'telemetry-manager',
    name: 'TelemetryManager.cs',
    filePath: 'Assets/Scripts/Assessment/TelemetryManager.cs',
    summary: 'Continuously records high-frequency telemetry samples (timestamp, speed, acceleration, throttle, brake, steer, position, speed limit, hard braking, aggressive accel) and provides export utilities.',
    inspectorFields: [
      { name: 'sampleRateHz', type: 'float', defaultValue: '10.0f', description: 'Telemetry recording frequency in Hertz (samples per second)' },
      { name: 'hardBrakingThreshold', type: 'float', defaultValue: '-6.5f', description: 'Longitudinal deceleration threshold (m/s²) triggering hard braking event' },
      { name: 'aggressiveAccelThreshold', type: 'float', defaultValue: '4.8f', description: 'Longitudinal acceleration threshold (m/s²) triggering aggressive acceleration' },
      { name: 'playerCar', type: 'CarController', defaultValue: 'Car_Player', description: 'Reference to active vehicle controller' }
    ],
    code: `using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Simulator.Assessment
{
    [System.Serializable]
    public struct TelemetryRecord
    {
        public float timestamp;
        public float speedKmh;
        public float accelerationMs2;
        public float throttle;
        public float brake;
        public float steerAngle;
        public Vector3 position;
        public float currentSpeedLimit;
        public bool isHardBraking;
        public bool isAggressiveAccel;
    }

    /// <summary>
    /// Captures driving telemetry at a fixed frequency for post-drive behavior analysis.
    /// Detects high-G dynamic events (hard braking and aggressive acceleration).
    /// </summary>
    public class TelemetryManager : MonoBehaviour
    {
        public static TelemetryManager Instance { get; private set; }

        [Header("Sampling Configuration")]
        [SerializeField] private float sampleRateHz = 10f;
        [SerializeField] private float hardBrakingThreshold = -6.5f; // m/s^2 deceleration
        [SerializeField] private float aggressiveAccelThreshold = 4.8f; // m/s^2 acceleration

        [Header("Vehicle Source")]
        [SerializeField] private Vehicle.CarController playerCar;
        [SerializeField] private Rigidbody carRigidbody;

        private readonly List<TelemetryRecord> sessionRecords = new List<TelemetryRecord>();
        private float sampleTimer;
        private float previousSpeedMs;
        private bool isRecording = true;

        // Metric Counters
        public int HardBrakingEventsCount { get; private set; }
        public int AggressiveAccelEventsCount { get; private set; }
        public float MaxSpeedRecordedKmh { get; private set; }
        public float TotalDistanceTraveledMeters { get; private set; }
        public float ActiveSpeedLimit { get; set; } = 50f;

        public event Action<TelemetryRecord> OnSampleRecorded;
        public event Action OnHardBrakingDetected;
        public event Action OnAggressiveAccelDetected;

        public IReadOnlyList<TelemetryRecord> Records => sessionRecords;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (playerCar == null)
                playerCar = FindFirstObjectByType<Vehicle.CarController>();

            if (carRigidbody == null && playerCar != null)
                carRigidbody = playerCar.GetComponent<Rigidbody>();
        }

        private void Update()
        {
            if (!isRecording || carRigidbody == null) return;

            sampleTimer += Time.deltaTime;
            float sampleInterval = 1f / Mathf.Max(1f, sampleRateHz);

            if (sampleTimer >= sampleInterval)
            {
                sampleTimer = 0f;
                RecordTelemetrySample(sampleInterval);
            }
        }

        private void RecordTelemetrySample(float dt)
        {
            float speedMs = carRigidbody.linearVelocity.magnitude;
            float speedKmh = speedMs * 3.6f;
            float acceleration = (speedMs - previousSpeedMs) / dt;
            previousSpeedMs = speedMs;

            if (speedKmh > MaxSpeedRecordedKmh)
                MaxSpeedRecordedKmh = speedKmh;

            TotalDistanceTraveledMeters += speedMs * dt;

            // Detect kinematic events
            bool hardBrake = acceleration <= hardBrakingThreshold && speedKmh > 15f;
            bool aggressiveAccel = acceleration >= aggressiveAccelThreshold && speedKmh < 60f;

            if (hardBrake)
            {
                HardBrakingEventsCount++;
                OnHardBrakingDetected?.Invoke();
                Debug.LogWarning($"[TelemetryManager] ⚠️ Hard Braking Detected: {acceleration:F2} m/s²");
            }

            if (aggressiveAccel)
            {
                AggressiveAccelEventsCount++;
                OnAggressiveAccelDetected?.Invoke();
                Debug.LogWarning($"[TelemetryManager] ⚠️ Aggressive Acceleration: {acceleration:F2} m/s²");
            }

            TelemetryRecord record = new TelemetryRecord
            {
                timestamp = Time.timeSinceLevelLoad,
                speedKmh = speedKmh,
                accelerationMs2 = acceleration,
                throttle = Input.GetAxis("Vertical") > 0 ? Input.GetAxis("Vertical") : 0f,
                brake = Input.GetAxis("Vertical") < 0 ? Mathf.Abs(Input.GetAxis("Vertical")) : 0f,
                steerAngle = playerCar != null ? playerCar.CurrentSteerAngle : 0f,
                position = carRigidbody.position,
                currentSpeedLimit = ActiveSpeedLimit,
                isHardBraking = hardBrake,
                isAggressiveAccel = aggressiveAccel
            };

            sessionRecords.Add(record);
            OnSampleRecorded?.Invoke(record);
        }

        public void StartRecording()
        {
            isRecording = true;
        }

        public void StopRecording()
        {
            isRecording = false;
        }

        public void ClearSession()
        {
            sessionRecords.Clear();
            HardBrakingEventsCount = 0;
            AggressiveAccelEventsCount = 0;
            MaxSpeedRecordedKmh = 0f;
            TotalDistanceTraveledMeters = 0f;
        }

        public string ExportTelemetryCsv()
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("Timestamp,SpeedKmh,AccelerationMs2,Throttle,Brake,SteerAngle,PosX,PosY,PosZ,SpeedLimit,HardBraking,AggressiveAccel");

            foreach (var r in sessionRecords)
            {
                sb.AppendLine($"{r.timestamp:F2},{r.speedKmh:F1},{r.accelerationMs2:F2},{r.throttle:F2},{r.brake:F2},{r.steerAngle:F1},{r.position.x:F1},{r.position.y:F1},{r.position.z:F1},{r.currentSpeedLimit:F0},{r.isHardBraking},{r.isAggressiveAccel}");
            }
            return sb.ToString();
        }
    }
}`
  },
  {
    id: 'driving-score-manager',
    name: 'DrivingScoreManager.cs',
    filePath: 'Assets/Scripts/Assessment/DrivingScoreManager.cs',
    summary: 'Manages starting score of 100, configurable penalty deductions, driver tier classification (Excellent, Good, Needs Improvement, Unsafe), and event broadcasting.',
    inspectorFields: [
      { name: 'startingScore', type: 'int', defaultValue: '100', description: 'Initial driver score baseline' },
      { name: 'collisionPenalty', type: 'int', defaultValue: '20', description: 'Points deducted per collision impact' },
      { name: 'redLightPenalty', type: 'int', defaultValue: '15', description: 'Points deducted for running a red signal' },
      { name: 'wrongLanePenalty', type: 'int', defaultValue: '10', description: 'Points deducted for sustained wrong-lane driving' },
      { name: 'overspeedPenalty', type: 'int', defaultValue: '5', description: 'Points deducted per overspeeding violation' },
      { name: 'missedCheckpointPenalty', type: 'int', defaultValue: '5', description: 'Points deducted per bypassed route checkpoint' },
      { name: 'hardBrakingPenalty', type: 'int', defaultValue: '3', description: 'Points deducted per hard braking event' }
    ],
    code: `using System;
using UnityEngine;

namespace Simulator.Assessment
{
    public enum DriverClassification
    {
        Excellent,        // 90 - 100
        Good,             // 75 - 89
        NeedsImprovement, // 60 - 74
        UnsafeDriving     // < 60
    }

    /// <summary>
    /// Enforces the academic grading rubric starting from 100.
    /// Deducts configurable penalties for moving violations and kinematic extremes.
    /// Classifies drivers into 4 performance tiers.
    /// </summary>
    public class DrivingScoreManager : MonoBehaviour
    {
        public static DrivingScoreManager Instance { get; private set; }

        [Header("Scoring Baseline")]
        [SerializeField] private int startingScore = 100;

        [Header("Configurable Penalty Matrix")]
        [SerializeField] private int collisionPenalty = 20;
        [SerializeField] private int redLightPenalty = 15;
        [SerializeField] private int wrongLanePenalty = 10;
        [SerializeField] private int overspeedPenalty = 5;
        [SerializeField] private int missedCheckpointPenalty = 5;
        [SerializeField] private int hardBrakingPenalty = 3;

        // Violation Event Counters
        public int CollisionCount { get; private set; }
        public int RedLightViolationsCount { get; private set; }
        public int WrongLaneViolationsCount { get; private set; }
        public int OverspeedEventsCount { get; private set; }
        public int MissedCheckpointsCount { get; private set; }
        public int HardBrakingDeductionsCount { get; private set; }

        public int CurrentScore { get; private set; }

        public DriverClassification Classification => GetClassificationForScore(CurrentScore);

        public event Action<int, DriverClassification> OnScoreUpdated;
        public event Action<string, int> OnPenaltyApplied;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            CurrentScore = startingScore;
        }

        private void Start()
        {
            // Subscribe to Telemetry hard braking events
            if (TelemetryManager.Instance != null)
            {
                TelemetryManager.Instance.OnHardBrakingDetected += HandleHardBraking;
            }
        }

        private void OnDestroy()
        {
            if (TelemetryManager.Instance != null)
            {
                TelemetryManager.Instance.OnHardBrakingDetected -= HandleHardBraking;
            }
        }

        private void HandleHardBraking()
        {
            ApplyPenalty("Hard Braking", hardBrakingPenalty);
            HardBrakingDeductionsCount++;
        }

        public void ReportCollision()
        {
            ApplyPenalty("Collision", collisionPenalty);
            CollisionCount++;
        }

        public void ReportRedLight()
        {
            ApplyPenalty("Red Light Violation", redLightPenalty);
            RedLightViolationsCount++;
        }

        public void ReportWrongLane()
        {
            ApplyPenalty("Wrong Lane Driving", wrongLanePenalty);
            WrongLaneViolationsCount++;
        }

        public void ReportOverspeed()
        {
            ApplyPenalty("Overspeed Event", overspeedPenalty);
            OverspeedEventsCount++;
        }

        public void ReportMissedCheckpoint()
        {
            ApplyPenalty("Missed Route Checkpoint", missedCheckpointPenalty);
            MissedCheckpointsCount++;
        }

        public void ApplyPenalty(string reason, int points)
        {
            CurrentScore = Mathf.Max(0, CurrentScore - points);
            OnScoreUpdated?.Invoke(CurrentScore, Classification);
            OnPenaltyApplied?.Invoke(reason, points);

            Debug.Log($"[DrivingScoreManager] -{points} pts ({reason}). Current Score: {CurrentScore} ({Classification})");
        }

        public DriverClassification GetClassificationForScore(int score)
        {
            if (score >= 90) return DriverClassification.Excellent;
            if (score >= 75) return DriverClassification.Good;
            if (score >= 60) return DriverClassification.NeedsImprovement;
            return DriverClassification.UnsafeDriving;
        }

        public void ResetScore()
        {
            CurrentScore = startingScore;
            CollisionCount = 0;
            RedLightViolationsCount = 0;
            WrongLaneViolationsCount = 0;
            OverspeedEventsCount = 0;
            MissedCheckpointsCount = 0;
            HardBrakingDeductionsCount = 0;
            OnScoreUpdated?.Invoke(CurrentScore, Classification);
        }
    }
}`
  },
  {
    id: 'feedback-manager',
    name: 'FeedbackManager.cs',
    filePath: 'Assets/Scripts/Assessment/FeedbackManager.cs',
    summary: 'Generates explainable, human-readable feedback narratives, identifying positive driving habits, mistakes, and actionable recommendations.',
    inspectorFields: [
      { name: 'scoreManager', type: 'DrivingScoreManager', defaultValue: 'DrivingScoreManager', description: 'Source for violation tallies' },
      { name: 'telemetryManager', type: 'TelemetryManager', defaultValue: 'TelemetryManager', description: 'Source for kinematic telemetry data' }
    ],
    code: `using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Simulator.Assessment
{
    [System.Serializable]
    public class AssessmentReport
    {
        public int finalScore;
        public DriverClassification classification;
        public string executiveSummary;
        public List<string> strengths = new List<string>();
        public List<string> infractions = new List<string>();
        public List<string> recommendations = new List<string>();
    }

    /// <summary>
    /// Translates raw telemetry and penalty metrics into actionable, explainable driver training advice.
    /// Complies with college lab rubric requirements for transparent assessment.
    /// </summary>
    public class FeedbackManager : MonoBehaviour
    {
        public static FeedbackManager Instance { get; private set; }

        [SerializeField] private DrivingScoreManager scoreManager;
        [SerializeField] private TelemetryManager telemetryManager;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (scoreManager == null) scoreManager = DrivingScoreManager.Instance;
            if (telemetryManager == null) telemetryManager = TelemetryManager.Instance;
        }

        public AssessmentReport GenerateReport()
        {
            if (scoreManager == null) scoreManager = DrivingScoreManager.Instance;
            if (telemetryManager == null) telemetryManager = TelemetryManager.Instance;

            AssessmentReport report = new AssessmentReport
            {
                finalScore = scoreManager != null ? scoreManager.CurrentScore : 100,
                classification = scoreManager != null ? scoreManager.Classification : DriverClassification.Excellent
            };

            int collisions = scoreManager != null ? scoreManager.CollisionCount : 0;
            int redLights = scoreManager != null ? scoreManager.RedLightViolationsCount : 0;
            int wrongLanes = scoreManager != null ? scoreManager.WrongLaneViolationsCount : 0;
            int overspeeds = scoreManager != null ? scoreManager.OverspeedEventsCount : 0;
            int hardBrakes = telemetryManager != null ? telemetryManager.HardBrakingEventsCount : 0;

            // 1. Positive Behaviors (Strengths)
            if (collisions == 0)
                report.strengths.Add("Excellent spatial awareness: Zero collisions with roadside barriers or traffic vehicles.");
            if (redLights == 0)
                report.strengths.Add("Flawless intersection discipline: Stopped and complied with all traffic signal cycles.");
            if (wrongLanes == 0)
                report.strengths.Add("Solid lane adherence: Maintained correct right-lane positioning across all road segments.");
            if (overspeeds == 0)
                report.strengths.Add("Strict speed compliance: Stayed consistently within regulatory limits for all zones.");
            if (hardBrakes <= 1)
                report.strengths.Add("Smooth kinetic modulation: Progressive braking without sudden passenger jerk.");

            // 2. Infractions & Areas for Improvement
            if (collisions > 0)
                report.infractions.Add($"Involved in {collisions} collision impact event(s). Review clearance margins.");
            if (redLights > 0)
                report.infractions.Add($"Crossed {redLights} intersection stop line(s) during Red signal phases.");
            if (wrongLanes > 0)
                report.infractions.Add($"Drifted into oncoming traffic lane {wrongLanes} time(s).");
            if (overspeeds > 0)
                report.infractions.Add($"Exceeded posted speed limit on {overspeeds} occasion(s).");
            if (hardBrakes > 1)
                report.infractions.Add($"Braked sharply {hardBrakes} times, exceeding -6.5 m/s² deceleration threshold.");

            // 3. Actionable Recommendations
            if (overspeeds > 0)
                report.recommendations.Add("Monitor the speedometer HUD more frequently and observe roadside regulatory signs.");
            if (hardBrakes > 0)
                report.recommendations.Add("Start reducing vehicle speed earlier before approaching intersections and pedestrian crosswalks.");
            if (redLights > 0)
                report.recommendations.Add("Prepare to stop when the traffic signal changes to Yellow rather than accelerating through.");
            if (wrongLanes > 0)
                report.recommendations.Add("Maintain vehicle alignment with right-lane center dash markings, especially when steering into curves.");
            if (report.recommendations.Count == 0)
                report.recommendations.Add("Outstanding driving! Proceed to advanced weather scenarios (Rain & Night) to test low-grip handling.");

            // 4. Executive Summary Synthesis
            StringBuilder sb = new StringBuilder();
            sb.Append($"Driver achieved a score of {report.finalScore}/100 ({report.classification}). ");

            if (report.classification == DriverClassification.Excellent)
            {
                sb.Append("Demonstrated exemplary vehicle control, compliant speed discipline, and safe road etiquette.");
            }
            else if (report.classification == DriverClassification.Good)
            {
                if (overspeeds > 0)
                    sb.Append($"Your overall lane control was good, but you exceeded the speed limit {overspeeds} times.");
                else if (hardBrakes > 0)
                    sb.Append($"Overall driving was safe, but you braked sharply {hardBrakes} times before intersections.");
                else
                    sb.Append("Driving was generally safe and competent with minor infractions noted.");
            }
            else if (report.classification == DriverClassification.NeedsImprovement)
            {
                sb.Append("Inconsistent vehicle regulation detected. Excessive speed variations or multiple lane boundary breaches require practice.");
            }
            else
            {
                sb.Append("Significant unsafe driving behaviors detected including collisions or red light violations. Remedial training strongly recommended.");
            }

            report.executiveSummary = sb.ToString();
            return report;
        }
    }
}`
  },
  {
    id: 'assessment-ui',
    name: 'AssessmentUI.cs',
    filePath: 'Assets/Scripts/Assessment/AssessmentUI.cs',
    summary: 'Renders comprehensive post-drive assessment modal, live G-force acceleration meter, penalty breakdown, and natural language recommendations.',
    inspectorFields: [
      { name: 'assessmentPanel', type: 'GameObject', defaultValue: 'AssessmentModalPanel', description: 'Main popup container shown at session end' },
      { name: 'scoreText', type: 'TMP_Text', defaultValue: 'Txt_FinalScore', description: 'Displays numeric score 0-100' },
      { name: 'tierBadgeText', type: 'TMP_Text', defaultValue: 'Txt_TierBadge', description: 'Displays classification (Excellent/Good/Needs Improvement/Unsafe)' },
      { name: 'summaryText', type: 'TMP_Text', defaultValue: 'Txt_ExecutiveSummary', description: 'Displays synthesized natural language feedback' },
      { name: 'recommendationsText', type: 'TMP_Text', defaultValue: 'Txt_Recommendations', description: 'Bulleted list of actionable training tips' }
    ],
    code: `using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Simulator.Assessment
{
    /// <summary>
    /// Displays the academic assessment report card at destination completion or session pause.
    /// Provides transparent feedback and one-click session retry or telemetry CSV export.
    /// </summary>
    public class AssessmentUI : MonoBehaviour
    {
        [Header("Modal UI Elements")]
        [SerializeField] private GameObject assessmentPanel;
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text tierBadgeText;
        [SerializeField] private Image tierBadgeBackground;
        [SerializeField] private TMP_Text summaryText;
        [SerializeField] private TMP_Text strengthsText;
        [SerializeField] private TMP_Text infractionsText;
        [SerializeField] private TMP_Text recommendationsText;

        [Header("Buttons")]
        [SerializeField] private Button closeButton;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button exportCsvButton;

        private void Start()
        {
            if (assessmentPanel != null)
                assessmentPanel.SetActive(false);

            if (closeButton != null)
                closeButton.onClick.AddListener(Hide);

            if (restartButton != null)
                restartButton.onClick.AddListener(OnRestartClicked);

            if (exportCsvButton != null)
                exportCsvButton.onClick.AddListener(OnExportCsvClicked);
        }

        public void ShowReport()
        {
            if (FeedbackManager.Instance == null) return;

            AssessmentReport report = FeedbackManager.Instance.GenerateReport();

            if (assessmentPanel != null)
                assessmentPanel.SetActive(true);

            if (scoreText != null)
                scoreText.text = $"{report.finalScore}";

            if (tierBadgeText != null)
                tierBadgeText.text = report.classification.ToString();

            if (tierBadgeBackground != null)
            {
                switch (report.classification)
                {
                    case DriverClassification.Excellent:
                        tierBadgeBackground.color = new Color(0.1f, 0.8f, 0.3f);
                        break;
                    case DriverClassification.Good:
                        tierBadgeBackground.color = new Color(0.2f, 0.6f, 1f);
                        break;
                    case DriverClassification.NeedsImprovement:
                        tierBadgeBackground.color = new Color(1f, 0.65f, 0.1f);
                        break;
                    case DriverClassification.UnsafeDriving:
                        tierBadgeBackground.color = new Color(0.9f, 0.2f, 0.2f);
                        break;
                }
            }

            if (summaryText != null)
                summaryText.text = report.executiveSummary;

            if (strengthsText != null)
                strengthsText.text = report.strengths.Count > 0 ? "• " + string.Join("\\n• ", report.strengths) : "No notable strengths recorded.";

            if (infractionsText != null)
                infractionsText.text = report.infractions.Count > 0 ? "• " + string.Join("\\n• ", report.infractions) : "No violations recorded!";

            if (recommendationsText != null)
                recommendationsText.text = report.recommendations.Count > 0 ? "• " + string.Join("\\n• ", report.recommendations) : "Keep practicing consistent safe driving!";
        }

        public void Hide()
        {
            if (assessmentPanel != null)
                assessmentPanel.SetActive(false);
        }

        private void OnRestartClicked()
        {
            Hide();
            if (DrivingScoreManager.Instance != null)
                DrivingScoreManager.Instance.ResetScore();
            if (TelemetryManager.Instance != null)
                TelemetryManager.Instance.ClearSession();
            UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
        }

        private void OnExportCsvClicked()
        {
            if (TelemetryManager.Instance == null) return;
            string csv = TelemetryManager.Instance.ExportTelemetryCsv();
            string path = System.IO.Path.Combine(Application.persistentDataPath, $"telemetry_{System.DateTime.Now:yyyyMMdd_HHmmss}.csv");
            System.IO.File.WriteAllText(path, csv);
            Debug.Log($"[AssessmentUI] Telemetry CSV exported successfully to: {path}");
        }
    }
}`
  },
  {
    id: 'driver-profile-manager',
    name: 'DriverProfileManager.cs',
    filePath: 'Assets/Scripts/Profile/DriverProfileManager.cs',
    summary: 'Manages driver identity, license progression tiers, cumulative drive statistics, and profile persistence via JSON in persistentDataPath.',
    inspectorFields: [
      { name: 'defaultDriverName', type: 'string', defaultValue: 'Alex Carter', description: 'Default name for initial student profile' },
      { name: 'licenseTier', type: 'DriverLicenseTier', defaultValue: 'StudentPermit', description: 'License tier based on drive hours and safety rating' },
      { name: 'saveFileName', type: 'string', defaultValue: 'driver_profiles.json', description: 'Filename for persistent JSON profile archive' }
    ],
    code: `using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Simulator.Profile
{
    public enum DriverLicenseTier
    {
        StudentPermit,
        ProvisionalLicense,
        ClassCDriver,
        ProfessionalInstructor
    }

    [Serializable]
    public class DriverProfileData
    {
        public string driverId;
        public string driverName;
        public DriverLicenseTier licenseTier;
        public string registrationDate;
        public int totalDrives;
        public float totalDistanceKm;
        public float totalDriveTimeMinutes;
        public float averageScore;
        public float bestScore;
        public int totalCollisions;
        public int totalRedLights;
        public int totalOverspeedEvents;
    }

    [Serializable]
    public class DriverProfileContainer
    {
        public List<DriverProfileData> profiles = new List<DriverProfileData>();
        public string activeDriverId;
    }

    /// <summary>
    /// Phase 6: Manages driver identity, career history aggregation, and disk persistence.
    /// Supports multi-student lab roster switching and cumulative score tracking.
    /// </summary>
    public class DriverProfileManager : MonoBehaviour
    {
        public static DriverProfileManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private string defaultDriverName = "Alex Carter";
        [SerializeField] private string saveFileName = "driver_profiles.json";

        private DriverProfileContainer container = new DriverProfileContainer();
        public DriverProfileData ActiveProfile { get; private set; }

        public event Action<DriverProfileData> OnProfileChanged;
        public event Action<DriverProfileData> OnProfileUpdated;

        private string SaveFilePath => Path.Combine(Application.persistentDataPath, saveFileName);

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            LoadProfilesFromDisk();
        }

        public void LoadProfilesFromDisk()
        {
            if (File.Exists(SaveFilePath))
            {
                try
                {
                    string json = File.ReadAllText(SaveFilePath);
                    container = JsonUtility.FromJson<DriverProfileContainer>(json);
                    if (container == null) container = new DriverProfileContainer();
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[DriverProfileManager] Failed to read JSON profile: {ex.Message}. Initializing defaults.");
                    container = new DriverProfileContainer();
                }
            }

            if (container.profiles.Count == 0)
            {
                CreateNewProfile(defaultDriverName, DriverLicenseTier.StudentPermit);
            }
            else
            {
                ActiveProfile = container.profiles.Find(p => p.driverId == container.activeDriverId) ?? container.profiles[0];
            }

            OnProfileChanged?.Invoke(ActiveProfile);
        }

        public DriverProfileData CreateNewProfile(string name, DriverLicenseTier tier = DriverLicenseTier.StudentPermit)
        {
            DriverProfileData newProfile = new DriverProfileData
            {
                driverId = Guid.NewGuid().ToString().Substring(0, 8),
                driverName = string.IsNullOrEmpty(name) ? "New Driver" : name,
                licenseTier = tier,
                registrationDate = DateTime.Now.ToString("yyyy-MM-dd"),
                totalDrives = 0,
                totalDistanceKm = 0f,
                totalDriveTimeMinutes = 0f,
                averageScore = 100f,
                bestScore = 100f,
                totalCollisions = 0,
                totalRedLights = 0,
                totalOverspeedEvents = 0
            };

            container.profiles.Add(newProfile);
            SetActiveProfile(newProfile.driverId);
            SaveToDisk();
            return newProfile;
        }

        public void SetActiveProfile(string driverId)
        {
            DriverProfileData match = container.profiles.Find(p => p.driverId == driverId);
            if (match != null)
            {
                ActiveProfile = match;
                container.activeDriverId = driverId;
                SaveToDisk();
                OnProfileChanged?.Invoke(ActiveProfile);
                Debug.Log($"[DriverProfileManager] Active profile switched to: {ActiveProfile.driverName} ({ActiveProfile.driverId})");
            }
        }

        public void RecordCompletedSession(float sessionScore, float distanceMeters, float durationSeconds, int collisions, int redLights, int overspeeds)
        {
            if (ActiveProfile == null) return;

            ActiveProfile.totalDrives++;
            ActiveProfile.totalDistanceKm += (distanceMeters / 1000f);
            ActiveProfile.totalDriveTimeMinutes += (durationSeconds / 60f);

            // Calculate running average score
            ActiveProfile.averageScore = ((ActiveProfile.averageScore * (ActiveProfile.totalDrives - 1)) + sessionScore) / ActiveProfile.totalDrives;
            if (sessionScore > ActiveProfile.bestScore || ActiveProfile.totalDrives == 1)
            {
                ActiveProfile.bestScore = sessionScore;
            }

            ActiveProfile.totalCollisions += collisions;
            ActiveProfile.totalRedLights += redLights;
            ActiveProfile.totalOverspeedEvents += overspeeds;

            // Tier upgrade check
            if (ActiveProfile.totalDrives >= 10 && ActiveProfile.averageScore >= 85f && ActiveProfile.licenseTier == DriverLicenseTier.StudentPermit)
            {
                ActiveProfile.licenseTier = DriverLicenseTier.ProvisionalLicense;
                Debug.Log($"[DriverProfileManager] Congratulations! {ActiveProfile.driverName} promoted to Provisional License!");
            }
            else if (ActiveProfile.totalDrives >= 25 && ActiveProfile.averageScore >= 90f && ActiveProfile.licenseTier == DriverLicenseTier.ProvisionalLicense)
            {
                ActiveProfile.licenseTier = DriverLicenseTier.ClassCDriver;
                Debug.Log($"[DriverProfileManager] Outstanding! {ActiveProfile.driverName} promoted to Class C Driver!");
            }

            SaveToDisk();
            OnProfileUpdated?.Invoke(ActiveProfile);
        }

        public void SaveToDisk()
        {
            try
            {
                string json = JsonUtility.ToJson(container, true);
                File.WriteAllText(SaveFilePath, json);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[DriverProfileManager] Failed to save profiles to disk: {ex.Message}");
            }
        }

        public List<DriverProfileData> GetAllProfiles() => new List<DriverProfileData>(container.profiles);
    }
}`
  },
  {
    id: 'session-manager',
    name: 'SessionManager.cs',
    filePath: 'Assets/Scripts/Profile/SessionManager.cs',
    summary: 'Records session lifecycle, time-stamped checkpoints, rule violations, and serializes historical driving session records to JSON.',
    inspectorFields: [
      { name: 'sessionHistoryFileName', type: 'string', defaultValue: 'driving_sessions_history.json', description: 'Disk archive for historical session logs' },
      { name: 'maxStoredSessions', type: 'int', defaultValue: '100', description: 'Maximum session logs retained on disk' }
    ],
    code: `using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Simulator.Assessment;

namespace Simulator.Profile
{
    [Serializable]
    public class DrivingSessionRecord
    {
        public string sessionId;
        public string driverId;
        public string driverName;
        public string scenarioName;
        public string timestamp;
        public float durationSeconds;
        public float distanceMeters;
        public float averageSpeedKmh;
        public float maxSpeedKmh;
        public int finalScore;
        public string classification;
        public int collisionCount;
        public int redLightViolations;
        public int wrongLaneViolations;
        public int overspeedViolations;
        public int hardBrakingCount;
        public int aggressiveAccelCount;
        public int checkpointsCompleted;
        public List<string> positiveBehaviors = new List<string>();
        public List<string> infractions = new List<string>();
        public List<string> recommendations = new List<string>();
        public string executiveSummary;
    }

    [Serializable]
    public class SessionHistoryContainer
    {
        public List<DrivingSessionRecord> sessions = new List<DrivingSessionRecord>();
    }

    /// <summary>
    /// Phase 6: Session lifecycle recorder and persistent historical database.
    /// Emits events upon session initialization and completion for UI and Results dashboards.
    /// </summary>
    public class SessionManager : MonoBehaviour
    {
        public static SessionManager Instance { get; private set; }

        [Header("Persistence")]
        [SerializeField] private string sessionHistoryFileName = "driving_sessions_history.json";
        [SerializeField] private int maxStoredSessions = 100;

        private SessionHistoryContainer history = new SessionHistoryContainer();
        public DrivingSessionRecord CurrentSession { get; private set; }

        public event Action<DrivingSessionRecord> OnSessionStarted;
        public event Action<DrivingSessionRecord> OnSessionSaved;

        private float sessionStartTime;
        private Vector3 lastPlayerPosition;
        private float accumulatedDistanceMeters;

        private string HistoryFilePath => Path.Combine(Application.persistentDataPath, sessionHistoryFileName);

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            LoadSessionHistory();
        }

        public void StartNewSession(string scenarioName, string driverId = null, string driverName = null)
        {
            sessionStartTime = Time.time;
            accumulatedDistanceMeters = 0f;

            string dId = driverId ?? (DriverProfileManager.Instance?.ActiveProfile?.driverId ?? "DEFAULT");
            string dName = driverName ?? (DriverProfileManager.Instance?.ActiveProfile?.driverName ?? "Driver 1");

            CurrentSession = new DrivingSessionRecord
            {
                sessionId = "SESS-" + DateTime.Now.ToString("yyyyMMdd-HHmmss"),
                driverId = dId,
                driverName = dName,
                scenarioName = scenarioName,
                timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                finalScore = 100
            };

            Debug.Log($"[SessionManager] Started new driving session: {CurrentSession.sessionId} for {CurrentSession.driverName} in {scenarioName}");
            OnSessionStarted?.Invoke(CurrentSession);
        }

        public void UpdateDistance(Vector3 currentPosition)
        {
            if (lastPlayerPosition != Vector3.zero)
            {
                float step = Vector3.Distance(currentPosition, lastPlayerPosition);
                // Sanity check to avoid teleport spikes
                if (step < 20f)
                {
                    accumulatedDistanceMeters += step;
                }
            }
            lastPlayerPosition = currentPosition;
        }

        public DrivingSessionRecord FinalizeAndSaveSession(AssessmentReport report, float maxSpeedKmh, float avgSpeedKmh, int checkpointsCleared)
        {
            if (CurrentSession == null)
            {
                StartNewSession("Standard City");
            }

            CurrentSession.durationSeconds = Time.time - sessionStartTime;
            CurrentSession.distanceMeters = accumulatedDistanceMeters;
            CurrentSession.averageSpeedKmh = avgSpeedKmh;
            CurrentSession.maxSpeedKmh = maxSpeedKmh;
            CurrentSession.finalScore = report.finalScore;
            CurrentSession.classification = report.classification.ToString();
            CurrentSession.collisionCount = report.metrics.collisionCount;
            CurrentSession.redLightViolations = report.metrics.redLightCount;
            CurrentSession.wrongLaneViolations = report.metrics.laneViolationCount;
            CurrentSession.overspeedViolations = report.metrics.overspeedCount;
            CurrentSession.hardBrakingCount = report.metrics.hardBrakingCount;
            CurrentSession.aggressiveAccelCount = report.metrics.aggressiveAccelCount;
            CurrentSession.checkpointsCompleted = checkpointsCleared;

            CurrentSession.positiveBehaviors = new List<string>(report.strengths);
            CurrentSession.infractions = new List<string>(report.infractions);
            CurrentSession.recommendations = new List<string>(report.recommendations);
            CurrentSession.executiveSummary = report.executiveSummary;

            // Prepend to history (newest first)
            history.sessions.Insert(0, CurrentSession);
            if (history.sessions.Count > maxStoredSessions)
            {
                history.sessions.RemoveAt(history.sessions.Count - 1);
            }

            // Sync with DriverProfileManager
            DriverProfileManager.Instance?.RecordCompletedSession(
                CurrentSession.finalScore,
                CurrentSession.distanceMeters,
                CurrentSession.durationSeconds,
                CurrentSession.collisionCount,
                CurrentSession.redLightViolations,
                CurrentSession.overspeedViolations
            );

            SaveHistoryToDisk();
            OnSessionSaved?.Invoke(CurrentSession);

            Debug.Log($"[SessionManager] Session {CurrentSession.sessionId} saved with score {CurrentSession.finalScore}/100.");
            return CurrentSession;
        }

        private void LoadSessionHistory()
        {
            if (File.Exists(HistoryFilePath))
            {
                try
                {
                    string json = File.ReadAllText(HistoryFilePath);
                    history = JsonUtility.FromJson<SessionHistoryContainer>(json);
                    if (history == null) history = new SessionHistoryContainer();
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[SessionManager] Could not parse session history: {ex.Message}");
                    history = new SessionHistoryContainer();
                }
            }
        }

        private void SaveHistoryToDisk()
        {
            try
            {
                string json = JsonUtility.ToJson(history, true);
                File.WriteAllText(HistoryFilePath, json);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SessionManager] Failed to write session history to disk: {ex.Message}");
            }
        }

        public List<DrivingSessionRecord> GetSessionsForDriver(string driverId)
        {
            if (string.IsNullOrEmpty(driverId)) return new List<DrivingSessionRecord>(history.sessions);
            return history.sessions.FindAll(s => s.driverId == driverId);
        }

        public List<DrivingSessionRecord> GetAllSessions() => new List<DrivingSessionRecord>(history.sessions);
    }
}`
  },
  {
    id: 'results-manager',
    name: 'ResultsManager.cs',
    filePath: 'Assets/Scripts/Profile/ResultsManager.cs',
    summary: 'Computes multi-session statistical comparisons, personal score deltas, violation patterns, and prepares comprehensive analytics view models.',
    inspectorFields: [
      { name: 'targetPassingScore', type: 'int', defaultValue: '75', description: 'Passing benchmark score for certification' }
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simulator.Profile
{
    [Serializable]
    public class SessionComparisonResult
    {
        public DrivingSessionRecord sessionA;
        public DrivingSessionRecord sessionB;
        public int scoreDelta;
        public float avgSpeedDelta;
        public int collisionDelta;
        public int redLightDelta;
        public int hardBrakeDelta;
        public string progressVerdict;
    }

    [Serializable]
    public class DriverAnalyticsSummary
    {
        public int totalDrives;
        public float averageScore;
        public int personalBestScore;
        public float passRatePercentage;
        public int totalViolationsRecorded;
        public string mostFrequentInfraction;
        public float averageSpeedOverall;
    }

    /// <summary>
    /// Phase 6: Analytical engine calculating multi-session progression,
    /// comparisons between attempts, and statistical trends.
    /// </summary>
    public class ResultsManager : MonoBehaviour
    {
        public static ResultsManager Instance { get; private set; }

        [SerializeField] private int targetPassingScore = 75;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public DriverAnalyticsSummary ComputeDriverAnalytics(string driverId)
        {
            List<DrivingSessionRecord> sessions = SessionManager.Instance != null 
                ? SessionManager.Instance.GetSessionsForDriver(driverId) 
                : new List<DrivingSessionRecord>();

            DriverAnalyticsSummary summary = new DriverAnalyticsSummary();
            if (sessions.Count == 0) return summary;

            summary.totalDrives = sessions.Count;
            float scoreSum = 0f;
            float speedSum = 0f;
            int passedDrives = 0;
            int totalCol = 0;
            int totalRed = 0;
            int totalOver = 0;
            int totalHardBrake = 0;

            foreach (var s in sessions)
            {
                scoreSum += s.finalScore;
                speedSum += s.averageSpeedKmh;
                if (s.finalScore >= targetPassingScore) passedDrives++;
                if (s.finalScore > summary.personalBestScore) summary.personalBestScore = s.finalScore;

                totalCol += s.collisionCount;
                totalRed += s.redLightViolations;
                totalOver += s.overspeedViolations;
                totalHardBrake += s.hardBrakingCount;
            }

            summary.averageScore = scoreSum / sessions.Count;
            summary.averageSpeedOverall = speedSum / sessions.Count;
            summary.passRatePercentage = ((float)passedDrives / sessions.Count) * 100f;
            summary.totalViolationsRecorded = totalCol + totalRed + totalOver + totalHardBrake;

            // Determine most common infraction
            int maxV = Mathf.Max(totalCol, Mathf.Max(totalRed, Mathf.Max(totalOver, totalHardBrake)));
            if (maxV == 0) summary.mostFrequentInfraction = "None (Clean driving record)";
            else if (maxV == totalOver) summary.mostFrequentInfraction = "Overspeeding Zones";
            else if (maxV == totalHardBrake) summary.mostFrequentInfraction = "Hard / Abrupt Braking";
            else if (maxV == totalRed) summary.mostFrequentInfraction = "Red Light Crossing";
            else summary.mostFrequentInfraction = "Obstacle Collisions";

            return summary;
        }

        public SessionComparisonResult CompareSessions(DrivingSessionRecord prevSession, DrivingSessionRecord currentSession)
        {
            SessionComparisonResult comp = new SessionComparisonResult
            {
                sessionA = prevSession,
                sessionB = currentSession,
                scoreDelta = currentSession.finalScore - prevSession.finalScore,
                avgSpeedDelta = currentSession.averageSpeedKmh - prevSession.averageSpeedKmh,
                collisionDelta = currentSession.collisionCount - prevSession.collisionCount,
                redLightDelta = currentSession.redLightViolations - prevSession.redLightViolations,
                hardBrakeDelta = currentSession.hardBrakingCount - prevSession.hardBrakingCount
            };

            if (comp.scoreDelta > 5)
                comp.progressVerdict = $"Significant improvement (+{comp.scoreDelta} pts)! Fewer penalties recorded.";
            else if (comp.scoreDelta < -5)
                comp.progressVerdict = $"Regression detected ({comp.scoreDelta} pts). Review infractions carefully.";
            else
                comp.progressVerdict = "Consistent performance with similar control and discipline.";

            return comp;
        }
    }
}`
  },
  {
    id: 'driver-dashboard-ui',
    name: 'DriverDashboardUI.cs',
    filePath: 'Assets/Scripts/UI/DriverDashboardUI.cs',
    summary: 'Renders the comprehensive full-screen post-drive dashboard: driver profiles, career statistics cards, historical session log table, and comparative progression.',
    inspectorFields: [
      { name: 'dashboardCanvas', type: 'GameObject', defaultValue: 'DriverDashboardCanvas', description: 'Full-screen canvas for student profile and history' },
      { name: 'profileNameText', type: 'TMP_Text', defaultValue: 'Txt_DriverName', description: 'Displays active driver name' },
      { name: 'licenseBadgeText', type: 'TMP_Text', defaultValue: 'Txt_LicenseBadge', description: 'Displays student license level' },
      { name: 'careerDrivesText', type: 'TMP_Text', defaultValue: 'Txt_CareerDrives', description: 'Shows total lifetime sessions' },
      { name: 'careerAvgScoreText', type: 'TMP_Text', defaultValue: 'Txt_AvgScore', description: 'Shows lifetime average driving score' },
      { name: 'sessionHistoryContent', type: 'Transform', defaultValue: 'SessionScrollContent', description: 'Scrollable container instantiated with past drive cards' }
    ],
    code: `using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Simulator.Profile;

namespace Simulator.UI
{
    /// <summary>
    /// Phase 6: Post-Drive Results & Student History Dashboard UI.
    /// Provides tabs for Career Stats, Session History Log, and Multi-Session Comparison.
    /// </summary>
    public class DriverDashboardUI : MonoBehaviour
    {
        [Header("Containers")]
        [SerializeField] private GameObject dashboardCanvas;
        [SerializeField] private GameObject sessionCardPrefab;
        [SerializeField] private Transform sessionListContainer;

        [Header("Career Stat Fields")]
        [SerializeField] private TMP_Text driverNameText;
        [SerializeField] private TMP_Text licenseTierText;
        [SerializeField] private TMP_Text careerDrivesText;
        [SerializeField] private TMP_Text avgScoreText;
        [SerializeField] private TMP_Text bestScoreText;
        [SerializeField] private TMP_Text passRateText;
        [SerializeField] private TMP_Text topViolationText;

        [Header("Navigation Buttons")]
        [SerializeField] private Button closeDashboardButton;
        [SerializeField] private Button refreshHistoryButton;
        [SerializeField] private Button exportProfileJsonButton;

        private void Start()
        {
            if (dashboardCanvas != null)
                dashboardCanvas.SetActive(false);

            if (closeDashboardButton != null)
                closeDashboardButton.onClick.AddListener(HideDashboard);

            if (refreshHistoryButton != null)
                refreshHistoryButton.onClick.AddListener(PopulateDashboard);

            if (exportProfileJsonButton != null)
                exportProfileJsonButton.onClick.AddListener(OnExportProfileClicked);

            if (DriverProfileManager.Instance != null)
            {
                DriverProfileManager.Instance.OnProfileChanged += (p) => PopulateDashboard();
                DriverProfileManager.Instance.OnProfileUpdated += (p) => PopulateDashboard();
            }
        }

        public void ShowDashboard()
        {
            if (dashboardCanvas != null)
                dashboardCanvas.SetActive(true);

            PopulateDashboard();
        }

        public void HideDashboard()
        {
            if (dashboardCanvas != null)
                dashboardCanvas.SetActive(false);
        }

        public void PopulateDashboard()
        {
            var profile = DriverProfileManager.Instance?.ActiveProfile;
            if (profile != null)
            {
                if (driverNameText != null) driverNameText.text = profile.driverName;
                if (licenseTierText != null) licenseTierText.text = profile.licenseTier.ToString();
                if (careerDrivesText != null) careerDrivesText.text = $"{profile.totalDrives} drives";
                if (avgScoreText != null) avgScoreText.text = $"{profile.averageScore:F1} / 100";
                if (bestScoreText != null) bestScoreText.text = $"{profile.bestScore:F0} / 100";
            }

            if (ResultsManager.Instance != null && profile != null)
            {
                var analytics = ResultsManager.Instance.ComputeDriverAnalytics(profile.driverId);
                if (passRateText != null) passRateText.text = $"{analytics.passRatePercentage:F0}%";
                if (topViolationText != null) topViolationText.text = analytics.mostFrequentInfraction;
            }

            // Populate Session History List
            if (sessionListContainer != null && SessionManager.Instance != null)
            {
                // Clear existing cards
                foreach (Transform child in sessionListContainer)
                {
                    Destroy(child.gameObject);
                }

                List<DrivingSessionRecord> sessions = SessionManager.Instance.GetSessionsForDriver(profile?.driverId);
                foreach (var s in sessions)
                {
                    if (sessionCardPrefab != null)
                    {
                        GameObject card = Instantiate(sessionCardPrefab, sessionListContainer);
                        var txt = card.GetComponentInChildren<TMP_Text>();
                        if (txt != null)
                        {
                            txt.text = $"[{s.timestamp}] {s.scenarioName} — Score: {s.finalScore}/100 ({s.classification}) | Col: {s.collisionCount} | Red: {s.redLightViolations}";
                        }
                    }
                }
            }
        }

        private void OnExportProfileClicked()
        {
            DriverProfileManager.Instance?.SaveToDisk();
            Debug.Log($"[DriverDashboardUI] Profile JSON exported to: {Application.persistentDataPath}");
        }
    }
}`
  },
  {
    id: 'vehicle-audio',
    name: 'VehicleAudio.cs',
    filePath: 'Assets/Scripts/Audio/VehicleAudio.cs',
    summary: 'Procedural vehicle sound engine: dynamically pitch-shifts engine RPM audio, triggers tire squeal on lateral slip/hard braking, synthesizes blinker clicks, and plays collision impacts.',
    inspectorFields: [
      { name: 'engineSource', type: 'AudioSource', defaultValue: 'Audio_Engine', description: 'Looped engine motor clip source' },
      { name: 'tireSquealSource', type: 'AudioSource', defaultValue: 'Audio_TireSqueal', description: 'Looped skid/friction clip source' },
      { name: 'impactSource', type: 'AudioSource', defaultValue: 'Audio_CrashImpact', description: 'One-shot impact collision source' },
      { name: 'turnSignalSource', type: 'AudioSource', defaultValue: 'Audio_TurnSignal', description: 'One-shot blinker tick source' },
      { name: 'idlePitch', type: 'float', defaultValue: '0.75f', description: 'Engine pitch multiplier at idle standstill' },
      { name: 'topPitch', type: 'float', defaultValue: '2.4f', description: 'Engine pitch multiplier at rev limit (120 km/h)' },
      { name: 'squealSlipThreshold', type: 'float', defaultValue: '0.38f', description: 'Wheel slip ratio triggering tire screech sound' }
    ],
    code: `using System;
using UnityEngine;
using Simulator.Vehicle;

namespace Simulator.Audio
{
    /// <summary>
    /// Phase 7: Dynamic Vehicle Audio Engine.
    /// Real-time engine RPM audio pitch & volume modulation, tire slip screeching, 
    /// collision impacts, and turn indicator click audio.
    /// </summary>
    [RequireComponent(typeof(CarController))]
    public class VehicleAudio : MonoBehaviour
    {
        [Header("Audio Sources")]
        [SerializeField] private AudioSource engineSource;
        [SerializeField] private AudioSource tireSquealSource;
        [SerializeField] private AudioSource impactSource;
        [SerializeField] private AudioSource turnSignalSource;

        [Header("Audio Clips")]
        [SerializeField] private AudioClip collisionClip;
        [SerializeField] private AudioClip blinkerTickClip;
        [SerializeField] private AudioClip hornClip;

        [Header("Engine Pitch Modulation")]
        [Range(0.4f, 1.0f)] [SerializeField] private float idlePitch = 0.75f;
        [Range(1.5f, 3.5f)] [SerializeField] private float topPitch = 2.40f;
        [Range(0.2f, 1.0f)] [SerializeField] private float idleVolume = 0.40f;
        [Range(0.5f, 1.0f)] [SerializeField] private float maxSpeedVolume = 0.95f;
        [SerializeField] private float maxMeasuredSpeedKmh = 130f;

        [Header("Tire Skid Sound")]
        [SerializeField] private float squealSlipThreshold = 0.35f;
        [Range(0f, 1f)] [SerializeField] private float maxSquealVolume = 0.85f;

        private CarController carController;
        private Rigidbody carRigidbody;
        private bool isBlinkingLeft;
        private bool isBlinkingRight;
        private float blinkerTimer;
        private const float BLINK_INTERVAL = 0.45f;

        private void Awake()
        {
            carController = GetComponent<CarController>();
            carRigidbody = GetComponent<Rigidbody>();

            InitializeSource(ref engineSource, true, idleVolume);
            InitializeSource(ref tireSquealSource, true, 0f);
            InitializeSource(ref impactSource, false, 1f);
            InitializeSource(ref turnSignalSource, false, 0.6f);
        }

        private void InitializeSource(ref AudioSource src, bool loop, float initialVolume)
        {
            if (src == null)
            {
                src = gameObject.AddComponent<AudioSource>();
            }
            src.loop = loop;
            src.volume = initialVolume;
            src.playOnAwake = false;
            src.spatialBlend = 1f; // 3D spatial sound
            src.dopplerLevel = 0.4f;
            if (loop && !src.isPlaying && src.clip != null)
            {
                src.Play();
            }
        }

        private void Update()
        {
            UpdateEngineAudio();
            UpdateTireSquealAudio();
            UpdateTurnSignalAudio();
        }

        private void UpdateEngineAudio()
        {
            if (carController == null || engineSource == null) return;

            float speedKmh = carController.CurrentSpeedKmh;
            float speedRatio = Mathf.Clamp01(speedKmh / maxMeasuredSpeedKmh);

            // Synthesize simulated gear RPM ratio
            float gearRatio = (speedKmh % 35f) / 35f;
            float throttleInput = Mathf.Abs(Input.GetAxis("Vertical"));

            // Blend speed ratio with throttle load
            float targetPitch = Mathf.Lerp(idlePitch, topPitch, (speedRatio * 0.65f) + (gearRatio * 0.25f) + (throttleInput * 0.10f));
            float targetVolume = Mathf.Lerp(idleVolume, maxSpeedVolume, (speedRatio * 0.7f) + (throttleInput * 0.3f));

            engineSource.pitch = Mathf.Lerp(engineSource.pitch, targetPitch, Time.deltaTime * 6f);
            engineSource.volume = Mathf.Lerp(engineSource.volume, targetVolume, Time.deltaTime * 8f);

            if (!engineSource.isPlaying && engineSource.clip != null)
            {
                engineSource.Play();
            }
        }

        private void UpdateTireSquealAudio()
        {
            if (tireSquealSource == null) return;

            bool isHardBraking = Input.GetKey(KeyCode.Space) || (Input.GetAxis("Vertical") < -0.1f && carController.CurrentSpeedKmh > 15f);
            bool isSharpTurn = Mathf.Abs(Input.GetAxis("Horizontal")) > 0.7f && carController.CurrentSpeedKmh > 35f;

            float lateralSlip = 0f;
            if (carRigidbody != null && carController.CurrentSpeedKmh > 10f)
            {
                Vector3 forward = transform.forward;
                Vector3 vel = carRigidbody.linearVelocity.normalized;
                lateralSlip = Mathf.Abs(Vector3.Dot(transform.right, vel));
            }

            bool shouldSqueal = isHardBraking || isSharpTurn || (lateralSlip > squealSlipThreshold);

            if (shouldSqueal)
            {
                float targetVol = Mathf.Clamp(Mathf.Max(lateralSlip, isHardBraking ? 0.8f : 0.5f), 0.2f, maxSquealVolume);
                tireSquealSource.volume = Mathf.Lerp(tireSquealSource.volume, targetVol, Time.deltaTime * 12f);
                if (!tireSquealSource.isPlaying && tireSquealSource.clip != null)
                {
                    tireSquealSource.Play();
                }
            }
            else
            {
                tireSquealSource.volume = Mathf.Lerp(tireSquealSource.volume, 0f, Time.deltaTime * 10f);
                if (tireSquealSource.volume < 0.02f && tireSquealSource.isPlaying)
                {
                    tireSquealSource.Stop();
                }
            }
        }

        private void UpdateTurnSignalAudio()
        {
            // Toggle blinkers on Q/E keys
            if (Input.GetKeyDown(KeyCode.Q))
            {
                isBlinkingLeft = !isBlinkingLeft;
                if (isBlinkingLeft) isBlinkingRight = false;
            }
            if (Input.GetKeyDown(KeyCode.E))
            {
                isBlinkingRight = !isBlinkingRight;
                if (isBlinkingRight) isBlinkingLeft = false;
            }

            if (isBlinkingLeft || isBlinkingRight)
            {
                blinkerTimer += Time.deltaTime;
                if (blinkerTimer >= BLINK_INTERVAL)
                {
                    blinkerTimer = 0f;
                    PlayTurnSignalClick();
                }
            }
            else
            {
                blinkerTimer = 0f;
            }
        }

        public void PlayTurnSignalClick()
        {
            if (turnSignalSource != null && blinkerTickClip != null)
            {
                turnSignalSource.PlayOneShot(blinkerTickClip, 0.55f);
            }
        }

        public void PlayCollisionSound(float impactVelocity)
        {
            if (impactSource != null && collisionClip != null)
            {
                float vol = Mathf.Clamp01(impactVelocity / 15f);
                impactSource.pitch = UnityEngine.Random.Range(0.85f, 1.15f);
                impactSource.PlayOneShot(collisionClip, Mathf.Max(0.4f, vol));
            }
        }

        public void PlayHorn()
        {
            if (impactSource != null && hornClip != null)
            {
                impactSource.PlayOneShot(hornClip, 0.9f);
            }
        }

        private void OnCollisionEnter(Collision collision)
        {
            if (collision.relativeVelocity.magnitude > 2.5f)
            {
                PlayCollisionSound(collision.relativeVelocity.magnitude);
            }
        }
    }
}`
  },
  {
    id: 'vehicle-visual-effects',
    name: 'VehicleVisualEffects.cs',
    filePath: 'Assets/Scripts/Effects/VehicleVisualEffects.cs',
    summary: 'Renders synchronized visual effects: cockpit steering wheel angle rotation, emissive HDR brake lights, reversing tail lights, turn blinkers, and wheel spin.',
    inspectorFields: [
      { name: 'interiorSteeringWheel', type: 'Transform', defaultValue: 'SteeringWheel_Mesh', description: 'Cockpit interior steering wheel mesh transform' },
      { name: 'maxSteeringAngle', type: 'float', defaultValue: '450f', description: 'Max wheel rotation in degrees (1.25 turns lock-to-lock)' },
      { name: 'brakeLightRenderers', type: 'Renderer[]', defaultValue: 'TailLights', description: 'Rear tail light mesh renderers' },
      { name: 'brakeEmissionColor', type: 'Color', defaultValue: 'HDR Red (3.0)', description: 'Emissive glow intensity when braking' },
      { name: 'leftBlinkers', type: 'GameObject[]', defaultValue: 'LeftBlinkerLights', description: 'Left turn indicator light sources' },
      { name: 'rightBlinkers', type: 'GameObject[]', defaultValue: 'RightBlinkerLights', description: 'Right turn indicator light sources' }
    ],
    code: `using UnityEngine;
using Simulator.Vehicle;

namespace Simulator.Effects
{
    /// <summary>
    /// Phase 7: Real-Time Vehicle Visual Effects & Interior Rigging.
    /// Manages cockpit steering wheel rotation, HDR emissive brake glow,
    /// reversing lights, turn signal blinkers, and wheel mesh revolutions.
    /// </summary>
    public class VehicleVisualEffects : MonoBehaviour
    {
        [Header("Cockpit Interior Animation")]
        [SerializeField] private Transform interiorSteeringWheel;
        [SerializeField] private float maxSteeringAngle = 450f; // 1.25 turns
        [SerializeField] private float steerResponseSpeed = 12f;

        [Header("Lighting Materials")]
        [SerializeField] private Renderer[] brakeLightRenderers;
        [SerializeField] private Material brakeLightMaterialInstance;
        [ColorUsage(true, true)] [SerializeField] private Color brakeOffColor = new Color(0.2f, 0.02f, 0.02f);
        [ColorUsage(true, true)] [SerializeField] private Color brakeOnColor = new Color(3.5f, 0.1f, 0.1f);

        [Header("Turn Signal Indicator Objects")]
        [SerializeField] private GameObject[] leftBlinkers;
        [SerializeField] private GameObject[] rightBlinkers;
        [SerializeField] private float blinkCycleSeconds = 0.45f;

        [Header("Wheel Mesh Rotations")]
        [SerializeField] private Transform[] wheelsFront;
        [SerializeField] private Transform[] wheelsRear;

        private CarController carController;
        private float currentSteerAngleDeg;
        private bool isBlinkingLeft;
        private bool isBlinkingRight;
        private float blinkTimer;
        private bool blinkState;

        private void Awake()
        {
            carController = GetComponent<CarController>();

            if (brakeLightRenderers != null && brakeLightRenderers.Length > 0)
            {
                // Instantiate local material instance to avoid modifying shared material asset
                brakeLightMaterialInstance = brakeLightRenderers[0].material;
                foreach (var rend in brakeLightRenderers)
                {
                    rend.material = brakeLightMaterialInstance;
                }
            }
        }

        private void Update()
        {
            UpdateInteriorSteering();
            UpdateBrakeAndReverseLights();
            UpdateTurnIndicators();
            UpdateWheelRotations();
        }

        private void UpdateInteriorSteering()
        {
            if (interiorSteeringWheel == null) return;

            float horizontalInput = Input.GetAxis("Horizontal");
            float targetAngle = horizontalInput * maxSteeringAngle;
            currentSteerAngleDeg = Mathf.Lerp(currentSteerAngleDeg, targetAngle, Time.deltaTime * steerResponseSpeed);

            // Rotate around local Z axis for typical cockpit steering column
            interiorSteeringWheel.localRotation = Quaternion.Euler(0f, 0f, -currentSteerAngleDeg);
        }

        private void UpdateBrakeAndReverseLights()
        {
            if (brakeLightMaterialInstance == null) return;

            bool isBraking = Input.GetKey(KeyCode.Space) || (Input.GetAxis("Vertical") < 0f && carController != null && carController.CurrentSpeedKmh > 0.5f);

            Color targetColor = isBraking ? brakeOnColor : brakeOffColor;
            brakeLightMaterialInstance.SetColor("_EmissionColor", targetColor);
            DynamicGI.SetEmissive(brakeLightRenderers[0], targetColor);
        }

        private void UpdateTurnIndicators()
        {
            if (Input.GetKeyDown(KeyCode.Q))
            {
                isBlinkingLeft = !isBlinkingLeft;
                if (isBlinkingLeft) isBlinkingRight = false;
            }
            if (Input.GetKeyDown(KeyCode.E))
            {
                isBlinkingRight = !isBlinkingRight;
                if (isBlinkingRight) isBlinkingLeft = false;
            }

            if (isBlinkingLeft || isBlinkingRight)
            {
                blinkTimer += Time.deltaTime;
                if (blinkTimer >= blinkCycleSeconds)
                {
                    blinkTimer = 0f;
                    blinkState = !blinkState;
                }
            }
            else
            {
                blinkTimer = 0f;
                blinkState = false;
            }

            ToggleBlinkers(leftBlinkers, isBlinkingLeft && blinkState);
            ToggleBlinkers(rightBlinkers, isBlinkingRight && blinkState);
        }

        private void ToggleBlinkers(GameObject[] lights, bool active)
        {
            if (lights == null) return;
            foreach (var light in lights)
            {
                if (light != null) light.SetActive(active);
            }
        }

        private void UpdateWheelRotations()
        {
            if (carController == null) return;

            float speedMs = carController.CurrentSpeedKmh / 3.6f;
            float wheelCircumference = 2f * Mathf.PI * 0.35f; // Radius approx 0.35m
            float rotationDegPerSec = (speedMs / wheelCircumference) * 360f;
            float frameRot = rotationDegPerSec * Time.deltaTime;

            RotateWheelGroup(wheelsFront, frameRot);
            RotateWheelGroup(wheelsRear, frameRot);
        }

        private void RotateWheelGroup(Transform[] wheels, float deltaDeg)
        {
            if (wheels == null) return;
            foreach (var w in wheels)
            {
                if (w != null) w.Rotate(Vector3.right, deltaDeg, Space.Self);
            }
        }
    }
}`
  },
  {
    id: 'lab-report-exporter',
    name: 'LabReportExporter.cs',
    filePath: 'Assets/Scripts/Reporting/LabReportExporter.cs',
    summary: 'Generates formal Academic / Driving School Laboratory Competency Evaluation Certificates and printable HTML/PDF reports with rubric scores and digital hash signatures.',
    inspectorFields: [
      { name: 'institutionName', type: 'string', defaultValue: 'Virtual Driving Mechanics & Safety Institute', description: 'Issuing academy or university department name' },
      { name: 'examinerTitle', type: 'string', defaultValue: 'Senior Driving Assessment Examiner', description: 'Instructor accreditation credential' },
      { name: 'passingThreshold', type: 'int', defaultValue: '75', description: 'Required score out of 100 to issue Passing certification' },
      { name: 'includeRubricMatrix', type: 'bool', defaultValue: 'true', description: 'Includes detailed 4-pillar competency breakdown' }
    ],
    code: `using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using Simulator.Profile;

namespace Simulator.Reporting
{
    [Serializable]
    public class CompetencyRubricGrade
    {
        public string competencyArea;
        public int maxPoints;
        public int earnedPoints;
        public string assessmentNotes;
    }

    [Serializable]
    public class AcademicLabCertificate
    {
        public string certificateId;
        public string institution;
        public string studentId;
        public string studentName;
        public string licenseTier;
        public string sessionDate;
        public string scenarioCompleted;
        public int finalScore;
        public string letterGrade;
        public bool isPass;
        public float totalDistanceMeters;
        public float driveDurationSeconds;
        public float averageSpeedKmh;
        public float peakSpeedKmh;
        public int collisionCount;
        public int redLightViolations;
        public int overspeedViolations;
        public int hardBrakingCount;
        public string examinerRemarks;
        public string digitalVerificationChecksum;
    }

    /// <summary>
    /// Phase 7: Academic Laboratory Report & Certification Exporter.
    /// Serializes session evaluation into university grading certificates,
    /// complete with letter grades, competency rubric matrices, and printable HTML/JSON files.
    /// </summary>
    public class LabReportExporter : MonoBehaviour
    {
        public static LabReportExporter Instance { get; private set; }

        [SerializeField] private string institutionName = "Automotive Simulation & Safety Laboratory";
        [SerializeField] private string examinerTitle = "Certified Sim-Lab Safety Examiner";
        [SerializeField] private int passingThreshold = 75;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);
        }

        public AcademicLabCertificate GenerateCertificate(DrivingSessionRecord session, DriverProfileData profile)
        {
            string certId = $"CERT-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 6).ToUpper()}";
            string letterGrade = ComputeLetterGrade(session.finalScore);
            bool pass = session.finalScore >= passingThreshold;

            string remarks = pass
                ? "The candidate demonstrated satisfactory vehicle control, regulation compliance, and cautious road behavior."
                : "The candidate failed to meet minimum road safety criteria. Mandatory remedial driving sessions required.";

            // Compute SHA-256 digital verification hash
            string rawPayload = $"{certId}|{profile.driverId}|{session.sessionId}|{session.finalScore}|{session.timestamp}";
            string checksum = ComputeSha256(rawPayload);

            AcademicLabCertificate cert = new AcademicLabCertificate
            {
                certificateId = certId,
                institution = institutionName,
                studentId = profile.driverId,
                studentName = profile.driverName,
                licenseTier = profile.licenseTier.ToString(),
                sessionDate = session.timestamp,
                scenarioCompleted = session.scenarioName,
                finalScore = session.finalScore,
                letterGrade = letterGrade,
                isPass = pass,
                totalDistanceMeters = session.distanceMeters,
                driveDurationSeconds = session.durationSeconds,
                averageSpeedKmh = session.averageSpeedKmh,
                peakSpeedKmh = session.maxSpeedKmh,
                collisionCount = session.collisionCount,
                redLightViolations = session.redLightViolations,
                overspeedViolations = session.overspeedViolations,
                hardBrakingCount = session.hardBrakingCount,
                examinerRemarks = remarks,
                digitalVerificationChecksum = checksum
            };

            return cert;
        }

        public string ExportHtmlReport(AcademicLabCertificate cert)
        {
            string html = $@"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'/>
    <title>Driving Lab Certificate - {cert.certificateId}</title>
    <style>
        body {{ font-family: 'Segoe UI', Helvetica, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }}
        .cert-card {{ max-width: 800px; margin: 0 auto; background: #1e293b; border: 2px solid #3b82f6; border-radius: 16px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
        .header {{ text-align: center; border-bottom: 2px solid #334155; padding-bottom: 20px; }}
        .title {{ font-size: 24px; font-weight: bold; color: #60a5fa; margin: 0; }}
        .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 4px; }}
        .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }}
        .item {{ background: #0f172a; padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; }}
        .label {{ font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }}
        .value {{ font-size: 16px; font-weight: bold; color: #ffffff; margin-top: 2px; }}
        .grade-badge {{ text-align: center; font-size: 42px; font-weight: 800; color: {(cert.isPass ? "#10b981" : "#ef4444")}; margin: 20px 0; }}
        .footer {{ font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; margin-top: 24px; word-break: break-all; }}
    </style>
</head>
<body>
    <div class='cert-card'>
        <div class='header'>
            <div class='title'>{cert.institution}</div>
            <div class='subtitle'>Official Driving Simulator Laboratory Competency Assessment</div>
        </div>
        <div class='grade-badge'>{cert.letterGrade} &bull; {(cert.isPass ? "PASS" : "FAIL")} ({cert.finalScore}/100)</div>
        <div class='grid'>
            <div class='item'><div class='label'>Student Driver</div><div class='value'>{cert.studentName} (ID: {cert.studentId})</div></div>
            <div class='item'><div class='label'>License Tier</div><div class='value'>{cert.licenseTier}</div></div>
            <div class='item'><div class='label'>Training Scenario</div><div class='value'>{cert.scenarioCompleted}</div></div>
            <div class='item'><div class='label'>Drive Duration / Distance</div><div class='value'>{cert.driveDurationSeconds:F0}s / {(cert.totalDistanceMeters / 1000f):F2} km</div></div>
            <div class='item'><div class='label'>Speed (Avg / Peak)</div><div class='value'>{cert.averageSpeedKmh:F1} / {cert.peakSpeedKmh:F1} km/h</div></div>
            <div class='item'><div class='label'>Penalties (Collisions / Red Lights)</div><div class='value'>{cert.collisionCount} collisions / {cert.redLightViolations} red lights</div></div>
        </div>
        <div style='background: #0f172a; padding: 14px; border-radius: 8px; border-left: 4px solid #3b82f6;'>
            <div class='label'>Examiner Assessment Verdict</div>
            <div style='font-size: 13px; color: #cbd5e1; margin-top: 4px;'>{cert.examinerRemarks}</div>
        </div>
        <div class='footer'>
            Certificate Serial: {cert.certificateId} | Timestamp: {cert.sessionDate}<br/>
            Cryptographic SHA-256 Validation Hash: {cert.digitalVerificationChecksum}
        </div>
    </div>
</body>
</html>";

            string path = Path.Combine(Application.persistentDataPath, $"{cert.certificateId}.html");
            File.WriteAllText(path, html);
            Debug.Log($"[LabReportExporter] Lab certificate exported cleanly to HTML: {path}");
            return path;
        }

        private string ComputeLetterGrade(int score)
        {
            if (score >= 95) return "A+";
            if (score >= 90) return "A";
            if (score >= 80) return "B";
            if (score >= 70) return "C";
            if (score >= 60) return "D";
            return "F";
        }

        private string ComputeSha256(string raw)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in bytes) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }
    }
}`
  }
];


export const UNITY_STEPS: UnityStep[] = [
  {
    stepNumber: 1,
    title: 'Project Folder Structure & Physics Setup',
    category: 'Setup',
    whatToCreate: 'Project folder hierarchy in the Project window and 3D Physics gravity verification.',
    whereToCreate: 'Assets/ root directory in the Project view.',
    gameObjectsRequired: ['None (Project Window setup)'],
    componentsToAdd: [],
    inspectorConfiguration: [
      { field: 'Edit > Project Settings > Physics > Gravity', type: 'Vector3', value: '(0, -9.81, 0)', notes: 'Standard earth gravity for WheelColliders' },
      { field: 'Edit > Project Settings > Physics > Default Solver Iterations', type: 'int', value: '10', notes: 'Higher iterations prevent wheel jitter' },
      { field: 'Edit > Project Settings > Physics > Default Solver Velocity Iterations', type: 'int', value: '4', notes: 'Smooth high-speed contact' }
    ],
    howToConnect: [
      'In the Project tab, right-click on "Assets" and choose Create > Folder.',
      'Create the following exact folders: Scenes, Scripts/Vehicle, Scripts/Camera, Scripts/UI, Prefabs, Materials.',
      'Save empty initial scenes: "Assets/Scenes/MainMenu.unity" and "Assets/Scenes/DrivingScene.unity".',
      'Go to File > Build Settings, click "Add Open Scenes" and add MainMenu (Index 0) and DrivingScene (Index 1).'
    ],
    howToTest: [
      'Check Build Settings to ensure both scenes are registered with indices 0 and 1.',
      'Verify the console has zero warnings or missing folder references.'
    ],
    proTips: [
      'Adding scenes to Build Settings immediately prevents "Scene could not be loaded because it has not been added to the build settings" errors later.'
    ]
  },
  {
    stepNumber: 2,
    title: 'Driving Scene Environment (Ground, Road & Scenery)',
    category: 'Environment',
    whatToCreate: 'Straight asphalt road with lane markings, grass ground plane, directional sun light, and basic roadside barriers/trees.',
    whereToCreate: 'Open Assets/Scenes/DrivingScene.unity in the Scene view.',
    gameObjectsRequired: [
      'Ground (3D Plane: Scale 100, 1, 300, Position 0, 0, 100)',
      'Road (3D Cube or Plane: Scale 10, 0.05, 300, Position 0, 0.02, 100)',
      'CenterLaneMarkings (Multiple thin White Quads or repeated textured plane: Width 0.2, Length 3, spaced by 4m)',
      'Directional Light (Sun: Rotation 50, -30, 0, Shadows Soft)',
      'RoadsideObjects (Empty parent containing alternating barrier cubes / lamp cylinders)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Ground',
        component: 'MeshCollider',
        settings: { 'Material': 'PhysicMaterial (Friction: 0.6, 0.6, Combine: Average)' }
      },
      {
        targetObject: 'Road',
        component: 'BoxCollider',
        settings: { 'Physic Material': 'RoadPhysicMaterial (Dynamic Friction: 0.8, Static Friction: 0.8)' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Road Material Albedo', type: 'Color', value: '#24272D (Dark Charcoal Asphalt)', notes: 'Smoothness 0.25' },
      { field: 'Ground Material Albedo', type: 'Color', value: '#3B6B35 (Grass Green)', notes: 'Smoothness 0.1' },
      { field: 'Road Markings Albedo', type: 'Color', value: '#FFFFFF (White / High Contrast)', notes: 'Dashed stripes along center line' }
    ],
    howToConnect: [
      'Create 3D Object > Plane, rename to "Ground", scale to X: 100, Y: 1, Z: 300.',
      'Create 3D Object > Cube, rename to "Road_Straight", position at (0, 0.02, 100), scale to X: 12, Y: 0.05, Z: 300.',
      'Create Materials/Mat_Asphalt and Materials/Mat_Grass, drag them onto Road and Ground respectively.',
      'Create an empty GameObject named "Environment_Container" and group roadside trees/posts under it.'
    ],
    howToTest: [
      'Ensure the Road surface is slightly above the ground (Y = 0.02) so there is no Z-fighting flickering.',
      'Drop a default 3D Sphere with a Rigidbody onto the road to verify it hits the collider and rolls smoothly.'
    ],
    proTips: [
      'Avoid high-polygon assets for Phase 1. Simple primitive shapes (Cubes, Cylinders) keep the project lightweight and compilation instantaneous.'
    ]
  },
  {
    stepNumber: 3,
    title: 'Vehicle GameObject & Rigidbody Hierarchy',
    category: 'Vehicle',
    whatToCreate: 'The Player Car GameObject hierarchy separating physics colliders, visual meshes, and WheelColliders.',
    whereToCreate: 'Inside DrivingScene, create at position (0, 0.8, 0).',
    gameObjectsRequired: [
      'Car_Player (Empty Root with Rigidbody, CarController, VehicleInput)',
      '├── CarBody_Visual (3D Cube for chassis + 3D Cube for cabin roof)',
      '├── Colliders (Child with BoxCollider for body collision)',
      '├── WheelColliders (Empty Parent)',
      '│   ├── Wheel_FL_Collider (WheelCollider)',
      '│   ├── Wheel_FR_Collider (WheelCollider)',
      '│   ├── Wheel_RL_Collider (WheelCollider)',
      '│   └── Wheel_RR_Collider (WheelCollider)',
      '└── WheelMeshes (Empty Parent with 4 Cylinder visuals rotated 90 deg on Z)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Car_Player',
        component: 'Rigidbody',
        settings: {
          'Mass': '1400 kg',
          'Drag': '0.05',
          'Angular Drag': '2.5',
          'Interpolate': 'Interpolate',
          'Collision Detection': 'Continuous'
        }
      },
      {
        targetObject: 'Colliders > BodyCollider',
        component: 'BoxCollider',
        settings: {
          'Size': 'X: 1.8, Y: 0.8, Z: 4.2',
          'Center': 'X: 0, Y: 0.45, Z: 0'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Car_Player Rigidbody Mass', type: 'float', value: '1400', notes: 'Typical midsize passenger sedan weight' },
      { field: 'Car_Player Rigidbody Angular Drag', type: 'float', value: '2.5', notes: 'Dampens unwanted spinouts' },
      { field: 'WheelCollider Suspension Distance', type: 'float', value: '0.2', notes: '20cm suspension travel' },
      { field: 'Suspension Spring Spring', type: 'float', value: '35000', notes: 'Supports 1400kg car easily' },
      { field: 'Suspension Spring Damper', type: 'float', value: '4500', notes: 'Prevents pogo-stick oscillation' },
      { field: 'Suspension Target Position', type: 'float', value: '0.5', notes: 'Mid-travel neutral resting pose' }
    ],
    howToConnect: [
      'Set Wheel Collider Radius to 0.35m (standard 70cm diameter tire).',
      'Position Front WheelColliders at X: ±0.85, Y: 0.35, Z: 1.3.',
      'Position Rear WheelColliders at X: ±0.85, Y: 0.35, Z: -1.3.',
      'CRITICAL: Ensure the BoxCollider on the car body does NOT overlap the WheelColliders! Keep bottom of BoxCollider above wheel axes.'
    ],
    howToTest: [
      'Enter Play mode with only the Rigidbody and WheelColliders configured.',
      'The car should drop gently ~5cm and rest stably on its 4 suspension springs without tipping or exploding upward.'
    ],
    proTips: [
      'In Unity, if a child BoxCollider intersects with a WheelCollider, the physics engine produces extreme jitter or sends the car flying into the sky!'
    ]
  },
  {
    stepNumber: 4,
    title: 'CarController.cs & VehicleInput.cs Implementation',
    category: 'Vehicle',
    whatToCreate: 'Attach VehicleInput.cs and CarController.cs to Car_Player and wire all WheelCollider slots.',
    whereToCreate: 'Assets/Scripts/Vehicle/ in Project tab.',
    gameObjectsRequired: ['Car_Player'],
    componentsToAdd: [
      {
        targetObject: 'Car_Player',
        component: 'VehicleInput.cs',
        settings: { 'Horizontal': 'Horizontal', 'Vertical': 'Vertical', 'Handbrake Key': 'Space' }
      },
      {
        targetObject: 'Car_Player',
        component: 'CarController.cs',
        settings: { 'Max Motor Torque': '1600', 'Max Brake Torque': '3200', 'Max Steer Angle': '32', 'Max Speed Kmh': '130' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Front Left Collider', type: 'WheelCollider', value: 'Drag Wheel_FL_Collider' },
      { field: 'Front Right Collider', type: 'WheelCollider', value: 'Drag Wheel_FR_Collider' },
      { field: 'Rear Left Collider', type: 'WheelCollider', value: 'Drag Wheel_RL_Collider' },
      { field: 'Rear Right Collider', type: 'WheelCollider', value: 'Drag Wheel_RR_Collider' },
      { field: 'Front Left Transform', type: 'Transform', value: 'Drag Wheel_FL_Mesh' },
      { field: 'Front Right Transform', type: 'Transform', value: 'Drag Wheel_FR_Mesh' },
      { field: 'Rear Left Transform', type: 'Transform', value: 'Drag Wheel_RL_Mesh' },
      { field: 'Rear Right Transform', type: 'Transform', value: 'Drag Wheel_RR_Mesh' },
      { field: 'Center Of Mass Offset', type: 'Vector3', value: '(0, -0.55, 0.2)', notes: 'Lowers COM to prevent tipping' }
    ],
    scriptFileName: 'CarController.cs',
    howToConnect: [
      'Select Car_Player in the Hierarchy.',
      'Click Add Component > type "VehicleInput" > Enter.',
      'Click Add Component > type "CarController" > Enter.',
      'Drag each of the 4 WheelColliders and 4 Visual Wheel Transforms into their matching Inspector slots.'
    ],
    howToTest: [
      'Press Play in Unity.',
      'Press W: Car accelerates forward cleanly.',
      'Press S: Car brakes while moving forward, then engages Reverse once stopped.',
      'Press A/D: Front visual wheels and physics turn up to 32 degrees.',
      'Press Spacebar: Rear wheels lock with strong handbrake friction.'
    ],
    proTips: [
      'The Center Of Mass offset (0, -0.55, 0.2) is the #1 secret to beginner-friendly car handling. Default Unity Rigidbody calculates COM from visual mesh bounds which is too high and causes rollover.'
    ]
  },
  {
    stepNumber: 5,
    title: 'Smooth FollowCamera.cs Setup',
    category: 'Camera',
    whatToCreate: 'Third-person chase camera tracking the vehicle without shake.',
    whereToCreate: 'Main Camera inside DrivingScene.',
    gameObjectsRequired: ['Main Camera'],
    componentsToAdd: [
      {
        targetObject: 'Main Camera',
        component: 'FollowCamera.cs',
        settings: {
          'Target': 'Car_Player',
          'Distance': '6.2',
          'Height': '2.5',
          'Position Smooth Time': '0.12',
          'Rotation Damping': '6.0',
          'Look At Height Offset': '1.0'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Target', type: 'Transform', value: 'Car_Player (drag from Hierarchy)' },
      { field: 'Distance', type: 'float', value: '6.2', notes: 'Good overview of car and forward horizon' },
      { field: 'Height', type: 'float', value: '2.5', notes: 'Elevated enough to see lane markings ahead' },
      { field: 'Position Smooth Time', type: 'float', value: '0.12', notes: 'Spring-damped smooth chase' }
    ],
    scriptFileName: 'FollowCamera.cs',
    howToConnect: [
      'Select Main Camera in DrivingScene.',
      'Click Add Component > type "FollowCamera" > Enter.',
      'Drag Car_Player from the Hierarchy into the "Target" slot of the FollowCamera component.'
    ],
    howToTest: [
      'Press Play and drive around turning left and right.',
      'Confirm the camera smoothly trails behind the car and swings around the turn without shaking or cutting inside the car geometry.'
    ],
    proTips: [
      'FollowCamera runs in LateUpdate(). Because the Car updates its physics in FixedUpdate with RigidbodyInterpolation.Interpolate turned on, LateUpdate guarantees silky smooth visual camera motion.'
    ]
  },
  {
    stepNumber: 6,
    title: 'Speedometer & In-Game Driving HUD',
    category: 'UI',
    whatToCreate: 'UI Canvas displaying real physical speed (Speed: XX km/h), Drive/Reverse indicator, and on-screen Pause button.',
    whereToCreate: 'Inside DrivingScene > Canvas.',
    gameObjectsRequired: [
      'HUD_Canvas (Canvas: Render Mode Screen Space - Overlay, UI Scale Mode: Scale With Screen Size 1920x1080)',
      '├── SpeedometerPanel (Anchored Bottom-Left or Top-Left)',
      '│   ├── Text_Speed ("Speed: 0 km/h")',
      '│   └── Text_Gear ("GEAR: [ D ]")',
      '├── Button_Pause (Anchored Top-Right)',
      '└── EventSystem'
    ],
    componentsToAdd: [
      {
        targetObject: 'HUD_Canvas/SpeedometerPanel',
        component: 'SpeedometerUI.cs',
        settings: { 'Car Controller': 'Car_Player', 'Speed Text': 'Text_Speed', 'Gear Text': 'Text_Gear' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Canvas Scaler UI Scale Mode', type: 'enum', value: 'Scale With Screen Size', notes: 'Reference Resolution: 1920 x 1080' },
      { field: 'SpeedText Font Size', type: 'int', value: '28', notes: 'Bold, white with subtle shadow' },
      { field: 'GearText Font Size', type: 'int', value: '22', notes: 'Highlights D (Drive), R (Reverse), P (Handbrake)' }
    ],
    scriptFileName: 'SpeedometerUI.cs',
    howToConnect: [
      'GameObject > UI > Canvas. Name it "HUD_Canvas".',
      'Create UI > Text inside Canvas, name "Text_Speed".',
      'Create UI > Text inside Canvas, name "Text_Gear".',
      'Attach SpeedometerUI.cs to HUD_Canvas, drag Car_Player to Car Controller, and drag the two text components into their slots.'
    ],
    howToTest: [
      'Press Play.',
      'When stopped, HUD reads "Speed: 0 km/h" and "GEAR: [ N ]" or "[ P ]".',
      'Accelerate forward: Speed rises in accurate km/h and gear switches to "[ D ]".',
      'Brake to stop, then hold S: Gear switches to "[ R ]" in orange/red.'
    ],
    proTips: [
      'Calculating speed as `rb.linearVelocity.magnitude * 3.6f` represents authentic SI physical speed (meters/second converted to kilometers/hour).'
    ]
  },
  {
    stepNumber: 7,
    title: 'GameManager & Pause Menu System',
    category: 'Management',
    whatToCreate: 'GameManager script to handle Escape pause key, Pause Overlay panel, Resume, Restart, and Quit.',
    whereToCreate: 'Inside DrivingScene > GameManager GameObject.',
    gameObjectsRequired: [
      'GameManager (Empty GameObject)',
      'HUD_Canvas > Panel_Pause (Dark semi-transparent panel with Resume, Restart, Main Menu buttons)'
    ],
    componentsToAdd: [
      {
        targetObject: 'GameManager',
        component: 'GameManager.cs',
        settings: {
          'Main Menu Scene Name': '"MainMenu"',
          'Driving Scene Name': '"DrivingScene"',
          'Pause Menu Panel': 'HUD_Canvas/Panel_Pause'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Pause Menu Panel', type: 'GameObject', value: 'Drag Panel_Pause from Hierarchy' },
      { field: 'Driving Scene Name', type: 'string', value: '"DrivingScene"' },
      { field: 'Main Menu Scene Name', type: 'string', value: '"MainMenu"' }
    ],
    scriptFileName: 'GameManager.cs',
    howToConnect: [
      'Create UI > Panel inside HUD_Canvas, name "Panel_Pause". Style background with black 75% opacity.',
      'Add three UI Buttons: "Resume", "Restart", and "Main Menu".',
      'In Resume button OnClick() event, drag GameManager and select GameManager.ResumeGame().',
      'In Restart button OnClick() event, select GameManager.RestartDrivingScene().',
      'In Main Menu button OnClick() event, select GameManager.ReturnToMainMenu().'
    ],
    howToTest: [
      'While driving, press ESC or click Pause.',
      'The vehicle freezes in place (Time.timeScale = 0), and Pause Panel appears.',
      'Click Resume: Game continues immediately without glitches.'
    ],
    proTips: [
      'Always reset Time.timeScale = 1f before loading scenes to prevent new scenes from remaining frozen!'
    ]
  },
  {
    stepNumber: 8,
    title: 'Main Menu Scene Setup & Scene Flow',
    category: 'UI',
    whatToCreate: 'Clean, modern Main Menu scene with Title, Start Driving button, and Exit button.',
    whereToCreate: 'Open Assets/Scenes/MainMenu.unity.',
    gameObjectsRequired: [
      'Main Camera (Stationary with pleasant skybox/solid background)',
      'Canvas (Screen Space - Overlay)',
      '├── MenuPanel',
      '│   ├── TitleText ("Car Driving Simulator")',
      '│   ├── SubtitleText ("Phase 1 Prototype - Laboratory Project")',
      '│   ├── Button_Start ("Start Driving")',
      '│   └── Button_Exit ("Exit")',
      '├── GameManager (with GameManager.cs attached)',
      '└── EventSystem'
    ],
    componentsToAdd: [
      {
        targetObject: 'GameManager',
        component: 'GameManager.cs',
        settings: { 'Driving Scene Name': '"DrivingScene"', 'Main Menu Scene Name': '"MainMenu"' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Button_Start OnClick()', type: 'UnityEvent', value: 'GameManager.StartDriving()' },
      { field: 'Button_Exit OnClick()', type: 'UnityEvent', value: 'GameManager.ExitApplication()' }
    ],
    howToConnect: [
      'In Button_Start, add an entry to the OnClick() list.',
      'Drag GameManager GameObject into the object field.',
      'Select function GameManager > StartDriving().',
      'Repeat for Button_Exit with GameManager > ExitApplication().'
    ],
    howToTest: [
      'Open MainMenu scene in Unity and hit Play.',
      'Click "Start Driving" button: DrivingScene loads immediately with car ready to drive.',
      'Press ESC to pause, click "Main Menu", and verify clean return to MainMenu.'
    ],
    proTips: [
      'Ensure both MainMenu (index 0) and DrivingScene (index 1) are in File > Build Settings. Without this, SceneManager.LoadScene() will throw an error.'
    ]
  },
  {
    stepNumber: 9,
    title: 'Road Network & 4-Way Intersection Layout',
    category: 'Environment',
    whatToCreate: 'Expanded urban road network with a 4-way intersection, crosswalks, dual lanes, and stop lines.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Environment_Container',
    gameObjectsRequired: [
      'RoadNetwork (Empty Parent)',
      '├── Road_MainAvenue (Scale X: 14, Y: 0.05, Z: 200, Pos: 0, 0.02, 0)',
      '├── Road_CrossStreet (Scale X: 14, Y: 0.05, Z: 200, Pos: 0, 0.02, 100, Rot Y: 90)',
      '├── Intersection_Center (Plane X: 14, Z: 14, Pos: 0, 0.025, 100)',
      '├── Crosswalks (4 striped Quads positioned before each intersection entrance)',
      '└── StopLines (White rectangular Quads at 1.5m before crosswalks)'
    ],
    componentsToAdd: [
      {
        targetObject: 'RoadNetwork/Road_CrossStreet',
        component: 'BoxCollider',
        settings: { 'Physic Material': 'Mat_Asphalt (Friction 0.8)' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Road Avenue Width', type: 'float', value: '14.0m', notes: 'Allows two 3.5m lanes in each direction' },
      { field: 'Intersection Center Y Offset', type: 'float', value: '0.025m', notes: 'Layered slightly above straight road to avoid Z-fighting' },
      { field: 'Crosswalk Zebra Texture', type: 'Material', value: 'Mat_Crosswalk', notes: 'High contrast white/black stripes' }
    ],
    howToConnect: [
      'Create child GameObject under Environment_Container named "RoadNetwork".',
      'Duplicate Road_Straight and rotate 90 degrees around Y axis to form a 4-way intersection at Z: 100.',
      'Place 4 StopLine quads 10m before the intersection center on each road branch.',
      'Ensure all asphalt road meshes have BoxColliders enabled.'
    ],
    howToTest: [
      'Drive the car from Z: 0 towards the intersection at Z: 100.',
      'Verify the car smoothly traverses the junction without hitting invisible lips or collider gaps.'
    ],
    proTips: [
      'Keep road surfaces strictly coplanar. If overlapping road segments differ by more than 0.01m, WheelColliders can snag on the edges.'
    ]
  },
  {
    stepNumber: 10,
    title: 'Regulatory Traffic Signs & Signal Gantries',
    category: 'Environment',
    whatToCreate: 'Speed Limit signs (50 km/h, 30 km/h), Stop signs, and 3-aspect illuminated traffic signal gantries.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > RoadNetwork > SignsAndSignals',
    gameObjectsRequired: [
      'TrafficSignal_North (Gantry prefab with TrafficSignalGantry.cs attached)',
      '├── Pole & Arm (Cylinder / Box mesh)',
      '├── Housing (Dark metallic box)',
      '├── Lens_Red (Renderer with red emissive material)',
      '├── Lens_Yellow (Renderer with yellow emissive material)',
      '└── Lens_Green (Renderer with green emissive material)',
      'Sign_SpeedLimit_50 (Cylinder post + Octagon/Circle mesh with 50 km/h sign face)',
      'Sign_Stop (Cylinder post + Red Octagon mesh)'
    ],
    componentsToAdd: [
      {
        targetObject: 'TrafficSignal_North',
        component: 'TrafficSignalGantry.cs',
        settings: {
          'Green Duration': '12.0',
          'Yellow Duration': '3.5',
          'Red Duration': '10.0',
          'Initial Light': 'Green'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Green Lens Renderer', type: 'Renderer', value: 'Drag Lens_Green' },
      { field: 'Yellow Lens Renderer', type: 'Renderer', value: 'Drag Lens_Yellow' },
      { field: 'Red Lens Renderer', type: 'Renderer', value: 'Drag Lens_Red' },
      { field: 'Sign_SpeedLimit_50 Position', type: 'Vector3', value: '(7.5, 0, 30)', notes: 'Mounted on right roadside' }
    ],
    scriptFileName: 'TrafficSignalGantry.cs',
    howToConnect: [
      'Position TrafficSignal_North at the southeast corner of the intersection facing oncoming northbound traffic.',
      'Wire the 3 lens child MeshRenderers into the TrafficSignalGantry component inspector slots.',
      'Place a Stop sign at the right-side approach of the intersection.'
    ],
    howToTest: [
      'Hit Play in Unity and observe the traffic signal.',
      'Verify the green lens glows for 12 seconds, transitions to amber for 3.5 seconds, then red for 10 seconds.'
    ],
    proTips: [
      'Use Unity Standard shader emission color (`_EmissionColor`) multiplied by HDR intensity so the active lens clearly shines in daylight.'
    ]
  },
  {
    stepNumber: 11,
    title: 'Route Checkpoints & Destination Trigger System',
    category: 'Environment',
    whatToCreate: 'Sequential route checkpoints with visual gates and final destination parking zone.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Route_Navigation',
    gameObjectsRequired: [
      'CheckpointManager (GameObject with CheckpointManager.cs attached)',
      '├── Checkpoint_01 (Pos: 0, 1.2, 50 | BoxCollider trigger + glowing arch)',
      '├── Checkpoint_02 (Pos: 0, 1.2, 90 | before intersection)',
      '├── Checkpoint_03 (Pos: 30, 1.2, 100 | inside right-turn branch)',
      '├── Checkpoint_04 (Pos: 70, 1.2, 100 | avenue mid-point)',
      '└── DestinationZone (Pos: 110, 0.5, 100 | BoxCollider trigger + yellow bay lines)'
    ],
    componentsToAdd: [
      {
        targetObject: 'CheckpointManager',
        component: 'CheckpointManager.cs',
        settings: { 'Player Transform': 'Car_Player', 'Total Checkpoints': '4' }
      },
      {
        targetObject: 'Checkpoint_01',
        component: 'Checkpoint.cs',
        settings: { 'Checkpoint Index': '0', 'Is Trigger': 'True' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Checkpoint Trigger Collider', type: 'BoxCollider', value: 'Size X: 12, Y: 4, Z: 2', notes: 'Spans full road width so vehicle cannot miss it' },
      { field: 'Destination Trigger Collider', type: 'BoxCollider', value: 'Size X: 10, Y: 3, Z: 10', notes: 'Parking bay destination' },
      { field: 'Checkpoints List', type: 'List<Checkpoint>', value: 'Drag Checkpoint_01 to Checkpoint_04 in order' }
    ],
    scriptFileName: 'CheckpointManager.cs',
    howToConnect: [
      'Create Empty GameObject "Route_Navigation" and attach CheckpointManager.cs.',
      'Assign Car_Player into the "Player Transform" field.',
      'Add 4 Checkpoint child objects with Checkpoint.cs and BoxCollider (isTrigger = true).',
      'Add DestinationZone with BoxCollider (isTrigger = true).'
    ],
    howToTest: [
      'Drive through Checkpoint_01: Terminal logs "Checkpoint 1 passed" and marker turns green.',
      'Drive through all 4 checkpoints into DestinationZone: Terminal logs "Destination Successfully Reached!".'
    ],
    proTips: [
      'Ensure the root Car_Player has Tag = "Player". Checkpoint.cs checks other.CompareTag("Player") to prevent false triggers from roadside physics props.'
    ]
  },
  {
    stepNumber: 12,
    title: 'Multi-Camera System (1st-Person, 3rd-Person & Dashboard)',
    category: 'Camera',
    whatToCreate: 'CameraManager to seamlessly cycle between Cockpit (1st-Person), Chase (3rd-Person), and Hood (Dashboard) views via "C" key.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Camera_Rig',
    gameObjectsRequired: [
      'CameraManager (GameObject with CameraManager.cs attached)',
      '├── Camera_ThirdPerson (Main Camera from Phase 1 with FollowCamera.cs)',
      '├── Camera_FirstPerson (Child of Car_Player | Pos: -0.35, 1.2, 0.2 | Rot: 0, 0, 0)',
      '└── Camera_Dashboard (Child of Car_Player | Pos: 0, 0.85, 1.8 | Rot: 0, 0, 0)'
    ],
    componentsToAdd: [
      {
        targetObject: 'CameraManager',
        component: 'CameraManager.cs',
        settings: { 'Cycle Key': 'KeyCode.C', 'Initial Mode': 'ThirdPerson' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Third Person Camera', type: 'Camera', value: 'Drag Camera_ThirdPerson' },
      { field: 'First Person Camera', type: 'Camera', value: 'Drag Camera_FirstPerson' },
      { field: 'Dashboard Camera', type: 'Camera', value: 'Drag Camera_Dashboard' },
      { field: 'First Person Camera FOV', type: 'float', value: '75', notes: 'Wider FOV for realistic driver cockpit perspective' },
      { field: 'Dashboard Camera FOV', type: 'float', value: '65', notes: 'Focused road view' }
    ],
    scriptFileName: 'CameraManager.cs',
    howToConnect: [
      'Attach CameraManager.cs to a new GameObject named "CameraManager".',
      'Drag existing Phase 1 Main Camera into Third Person Camera slot.',
      'Create Camera_FirstPerson as a child under Car_Player at driver head position (-0.35, 1.2, 0.2).',
      'Create Camera_Dashboard as a child under Car_Player at front hood (0, 0.85, 1.8).',
      'Wire all 3 cameras into CameraManager Inspector slots.'
    ],
    howToTest: [
      'Hit Play in Unity.',
      'Default view is 3rd-Person chase camera.',
      'Press "C" key: Immediately switches to 1st-person cockpit view looking over dashboard.',
      'Press "C" key again: Switches to front hood / dashboard road view.',
      'Press "C" key again: Returns to 3rd-person chase camera.'
    ],
    proTips: [
      'Notice that Camera_FirstPerson and Camera_Dashboard are direct children of Car_Player. Their transforms naturally follow and rotate with the vehicle with zero script overhead!'
    ]
  },
  {
    stepNumber: 13,
    title: 'Route Guidance & Camera Mode HUD',
    category: 'UI',
    whatToCreate: 'HUD overlay displaying active camera view, current checkpoint progress, and distance to next checkpoint.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > HUD_Canvas > RoutePanel',
    gameObjectsRequired: [
      'HUD_Canvas > RoutePanel (Anchored Top-Left below Speedometer)',
      '├── Text_CameraMode ("[C] View: 3rd-Person Chase")',
      '├── Text_CheckpointProgress ("Checkpoints: 0 / 4")',
      '└── Text_DistanceNext ("Next Target: 50m")'
    ],
    componentsToAdd: [
      {
        targetObject: 'HUD_Canvas/RoutePanel',
        component: 'RouteHUD.cs',
        settings: {
          'Camera Mode Text': 'Text_CameraMode',
          'Checkpoint Progress Text': 'Text_CheckpointProgress',
          'Distance Next Text': 'Text_DistanceNext'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Text_CameraMode Font Size', type: 'int', value: '18', notes: 'Light blue color' },
      { field: 'Text_CheckpointProgress Font Size', type: 'int', value: '18', notes: 'White font with subtle shadow' },
      { field: 'Text_DistanceNext Font Size', type: 'int', value: '20', notes: 'Tabular numerals in meters' }
    ],
    scriptFileName: 'RouteHUD.cs',
    howToConnect: [
      'Add child GameObject "RoutePanel" inside existing HUD_Canvas.',
      'Attach RouteHUD.cs to RoutePanel.',
      'Drag the 3 UI Text components into the matching Inspector slots on RouteHUD.'
    ],
    howToTest: [
      'Drive toward Checkpoint 1: Distance counter counts down in meters in real-time.',
      'Cross Checkpoint 1: Checkpoint counter updates to "1 / 4".',
      'Press "C": Camera label updates instantly to "[C] View: 1st-Person Cockpit".'
    ],
    proTips: [
      'RouteHUD is completely decoupled from SpeedometerUI. If one UI element needs tweaking, it will never break the speedometer or speedometer physics.'
    ]
  },
  {
    stepNumber: 14,
    title: 'Phase 2 End-to-End Route Verification',
    category: 'Testing',
    whatToCreate: 'Full validation run navigating the complete course through intersection to destination.',
    whereToCreate: 'Play Mode across MainMenu and DrivingScene.',
    gameObjectsRequired: ['All Phase 1 and Phase 2 GameObjects'],
    componentsToAdd: [],
    inspectorConfiguration: [],
    howToConnect: [
      'Load MainMenu scene, click Start Driving.',
      'Cycle cameras using "C" key to test 1st-person, 3rd-person, and dashboard modes while accelerating.',
      'Observe traffic lights at intersection turning Green -> Yellow -> Red.',
      'Follow sequential checkpoints through the right turn at the junction.',
      'Park in DestinationZone.'
    ],
    howToTest: [
      'Verify: Camera switching works without stutter.',
      'Verify: Road intersection has no physics seam bugs.',
      'Verify: All 4 checkpoints register in sequence order.',
      'Verify: Destination triggered banner displays on HUD.'
    ],
    proTips: [
      'Congratulations! You have completed Phase 2. The physical training environment and multi-camera rig are now ready for Phase 3 rule violation sensors.'
    ]
  },
  {
    stepNumber: 15,
    title: 'Speed Limit Zones & Overspeed Detection',
    category: 'Management',
    whatToCreate: 'SpeedLimitZone trigger volume spanning the road to monitor player speed and enforce speed limits.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > RoadNetwork > Zones',
    gameObjectsRequired: [
      'Zone_SpeedLimit_50 (GameObject with BoxCollider trigger and SpeedLimitZone.cs attached)',
      '└── SpeedZoneMesh (Semi-transparent volume or trigger boundary spanning Z: 20 to Z: 85)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Zone_SpeedLimit_50',
        component: 'SpeedLimitZone.cs',
        settings: {
          'Speed Limit Kmh': '50.0',
          'Speed Tolerance Kmh': '3.0',
          'Grace Duration Seconds': '2.0'
        }
      },
      {
        targetObject: 'Zone_SpeedLimit_50',
        component: 'BoxCollider',
        settings: {
          'Is Trigger': 'True',
          'Center': 'X: 0, Y: 3, Z: 52.5',
          'Size': 'X: 16, Y: 6, Z: 65'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Speed Limit Kmh', type: 'float', value: '50.0', notes: 'Matches roadside 50 km/h sign' },
      { field: 'Speed Tolerance Kmh', type: 'float', value: '3.0', notes: 'Buffers minor speedometer fluctuations' },
      { field: 'Grace Duration Seconds', type: 'float', value: '2.0', notes: 'Prevents false penalty on momentary speed spikes' }
    ],
    scriptFileName: 'SpeedLimitZone.cs',
    howToConnect: [
      'Create Empty GameObject named "Zone_SpeedLimit_50" under RoadNetwork.',
      'Add BoxCollider, check "Is Trigger = true", size to X: 16, Y: 6, Z: 65.',
      'Attach SpeedLimitZone.cs and configure Speed Limit to 50.',
      'Ensure Car_Player has Tag = "Player".'
    ],
    howToTest: [
      'Accelerate car to 65 km/h inside the zone and sustain for > 2 seconds.',
      'Verify: Console logs "[SpeedLimitZone] Overspeeding detected! Speed: 65.0 km/h in 50 km/h zone."'
    ],
    proTips: [
      'A 2-second grace period is industry standard in driver telemetry simulators to reward drivers who quickly correct accidental speed creep.'
    ]
  },
  {
    stepNumber: 16,
    title: 'Intersection Stop-Line Sensor & Red-Light Violation',
    category: 'Management',
    whatToCreate: 'Trigger boundary at intersection stop line that detects unauthorized crossing during Red signal phases.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > RoadNetwork > Sensors',
    gameObjectsRequired: [
      'Sensor_StopLine_North (GameObject with BoxCollider trigger and TrafficSignalTrigger.cs attached)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Sensor_StopLine_North',
        component: 'TrafficSignalTrigger.cs',
        settings: { 'Signal Gantry': 'TrafficSignal_North (Reference)' }
      },
      {
        targetObject: 'Sensor_StopLine_North',
        component: 'BoxCollider',
        settings: {
          'Is Trigger': 'True',
          'Center': 'X: 0, Y: 2, Z: 86',
          'Size': 'X: 14, Y: 4, Z: 2'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Signal Gantry', type: 'TrafficSignalGantry', value: 'Drag TrafficSignal_North from Hierarchy' },
      { field: 'Collider Center', type: 'Vector3', value: '(0, 2, 86)', notes: 'Directly aligned with painted stop line' }
    ],
    scriptFileName: 'TrafficSignalTrigger.cs',
    howToConnect: [
      'Create Empty GameObject "Sensor_StopLine_North" directly above the stop line at Z: 86.',
      'Add BoxCollider with isTrigger = true, spanning road width (X: 14, Y: 4, Z: 2).',
      'Attach TrafficSignalTrigger.cs and drag TrafficSignal_North into the Signal Gantry slot.'
    ],
    howToTest: [
      'Wait until TrafficSignal_North turns Red (red lens illuminated).',
      'Drive across the stop line into the intersection.',
      'Verify: Console logs "[TrafficSignalTrigger] RED LIGHT VIOLATION! Vehicle crossed stop line on Red."'
    ],
    proTips: [
      'Keep the trigger thickness thin (Z: 2m) so entering on green and clearing the intersection during yellow does not trigger a false red-light event.'
    ]
  },
  {
    stepNumber: 17,
    title: 'Vehicle Impact & Collision Monitoring',
    category: 'Vehicle',
    whatToCreate: 'CollisionMonitor attached to Car_Player to detect collisions with obstacles, barriers, and other vehicles.',
    whereToCreate: 'Car_Player GameObject in DrivingScene.',
    gameObjectsRequired: [
      'Car_Player (Player vehicle with Rigidbody)',
      'RoadsideBarriers (Obstacle cubes with BoxColliders and Layer/Tag = "Obstacle")'
    ],
    componentsToAdd: [
      {
        targetObject: 'Car_Player',
        component: 'CollisionMonitor.cs',
        settings: {
          'Minimum Impact Velocity': '1.2 m/s',
          'Collision Debounce Seconds': '2.0 s'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Minimum Impact Velocity', type: 'float', value: '1.2', notes: 'Ignores harmless curb touches' },
      { field: 'Collision Debounce Seconds', type: 'float', value: '2.0', notes: 'Prevents multiple penalties for a single continuous impact' }
    ],
    scriptFileName: 'CollisionMonitor.cs',
    howToConnect: [
      'Select Car_Player in the Hierarchy.',
      'Click Add Component > type "CollisionMonitor" > Enter.',
      'Set Minimum Impact Velocity to 1.2 and Debounce to 2.0.',
      'Ensure roadside barriers and posts have BoxColliders enabled.'
    ],
    howToTest: [
      'Drive car into a roadside lamp post or concrete barrier at > 15 km/h.',
      'Verify: Console logs "[CollisionMonitor] IMPACT DETECTED with LampPost! Velocity: 5.4 m/s".'
    ],
    proTips: [
      'CollisionMonitor filters out collision with the road and ground planes automatically by checking the surface collider name.'
    ]
  },
  {
    stepNumber: 18,
    title: 'Lane Discipline & Wrong-Way Detection',
    category: 'Management',
    whatToCreate: 'LaneMonitor script monitoring vehicle lateral coordinates relative to center line divider.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Monitors',
    gameObjectsRequired: [
      'LaneMonitor (Empty GameObject with LaneMonitor.cs attached)'
    ],
    componentsToAdd: [
      {
        targetObject: 'LaneMonitor',
        component: 'LaneMonitor.cs',
        settings: {
          'Player Car': 'Car_Player',
          'Wrong Lane Sustained Duration': '1.5 s'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Player Car', type: 'CarController', value: 'Drag Car_Player from Hierarchy' },
      { field: 'Wrong Lane Sustained Duration', type: 'float', value: '1.5', notes: 'Driver must stay in oncoming lane for 1.5s' }
    ],
    scriptFileName: 'LaneMonitor.cs',
    howToConnect: [
      'Create Empty GameObject named "LaneMonitor" in DrivingScene.',
      'Attach LaneMonitor.cs and drag Car_Player into the Player Car reference field.'
    ],
    howToTest: [
      'Drive northbound while steering into the left (oncoming) lane (X < -1.5) for more than 1.5 seconds.',
      'Verify: Console logs "[LaneMonitor] WRONG LANE VIOLATION! Driving in oncoming traffic lane."'
    ],
    proTips: [
      'Speed filter (> 5 km/h) prevents false penalties when a driver is simply parallel parking or starting from a roadside curb.'
    ]
  },
  {
    stepNumber: 19,
    title: 'Central Violation Manager & Driving Score HUD',
    category: 'Management',
    whatToCreate: 'ViolationManager to aggregate all penalties and ViolationHUD to display the live 100-point score and alert popups.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > GameManager & HUD_Canvas',
    gameObjectsRequired: [
      'ViolationManager (Empty GameObject with ViolationManager.cs attached)',
      'HUD_Canvas > ViolationPanel',
      '├── Text_LiveScore ("Score: 100 / 100")',
      '└── Panel_ViolationAlert (Animated banner with Text_AlertMessage)'
    ],
    componentsToAdd: [
      {
        targetObject: 'ViolationManager',
        component: 'ViolationManager.cs',
        settings: {
          'Collision Penalty': '20',
          'Red Light Penalty': '15',
          'Wrong Lane Penalty': '10',
          'Overspeed Penalty': '5',
          'Starting Score': '100'
        }
      },
      {
        targetObject: 'HUD_Canvas/ViolationPanel',
        component: 'ViolationHUD.cs',
        settings: {
          'Score Text': 'Text_LiveScore',
          'Alert Banner Panel': 'Panel_ViolationAlert',
          'Alert Message Text': 'Text_AlertMessage'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Starting Score', type: 'int', value: '100', notes: 'Base score for each session' },
      { field: 'Collision Penalty', type: 'int', value: '20', notes: '-20 points per impact' },
      { field: 'Red Light Penalty', type: 'int', value: '15', notes: '-15 points per red light' },
      { field: 'Wrong Lane Penalty', type: 'int', value: '10', notes: '-10 points per lane breach' },
      { field: 'Overspeed Penalty', type: 'int', value: '5', notes: '-5 points per speed violation' }
    ],
    scriptFileName: 'ViolationManager.cs',
    howToConnect: [
      'Create Empty GameObject "ViolationManager" and attach ViolationManager.cs.',
      'In HUD_Canvas, create ViolationPanel with Text_LiveScore and Panel_ViolationAlert.',
      'Attach ViolationHUD.cs to ViolationPanel and wire text and alert panel references.'
    ],
    howToTest: [
      'Hit Play: HUD displays "Score: 100 / 100" in bright green.',
      'Exceed speed limit: Score drops to "95 / 100", amber banner flashes "⚠️ OVERSPEEDING: 64 KM/H IN 50 ZONE (-5 PTS)".',
      'Run a red light: Score drops by 15 points to "80 / 100" with alert banner.',
      'Crash into barrier: Score drops by 20 points.'
    ],
    proTips: [
      'All penalties are exposed as Inspector fields in ViolationManager.cs, making it easy to calibrate grading rubrics for college lab evaluations.'
    ]
  },
  {
    stepNumber: 20,
    title: 'Training Scenario Selection & Preset Coordinator',
    category: 'Management',
    whatToCreate: 'ScenarioManager GameObject coordinating training presets (City, Highway, Rain, Night) with automated lighting and asset toggling.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Managers > ScenarioManager',
    gameObjectsRequired: [
      'ScenarioManager (Empty GameObject with ScenarioManager.cs attached)'
    ],
    componentsToAdd: [
      {
        targetObject: 'ScenarioManager',
        component: 'ScenarioManager.cs',
        settings: {
          'Active Scenario': 'City',
          'Sun Light': 'Directional Light',
          'Traffic Container': 'TrafficVehicles',
          'Pedestrians Container': 'Pedestrians'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Active Scenario', type: 'ScenarioType', value: 'City (Default)', notes: 'Can be changed in Inspector or via Main Menu' },
      { field: 'Sun Light', type: 'Light', value: 'Drag Directional Light from Scene' },
      { field: 'Traffic Container', type: 'GameObject', value: 'Drag TrafficVehicles empty parent' },
      { field: 'Pedestrians Container', type: 'GameObject', value: 'Drag Pedestrians empty parent' }
    ],
    scriptFileName: 'ScenarioManager.cs',
    howToConnect: [
      'Create an Empty GameObject named "ScenarioManager" under Managers.',
      'Attach ScenarioManager.cs.',
      'Assign the scene Directional Light into Sun Light slot.',
      'Wire TrafficVehicles and Pedestrians parent GameObjects into their respective slots.'
    ],
    howToTest: [
      'In Play Mode, change Active Scenario in Inspector from City to Highway, Rain, and Night.',
      'Verify: Lighting, sun angle, and fog density shift immediately for each scenario.'
    ],
    proTips: [
      'ScenarioManager fires the OnScenarioChanged event, allowing UI indicators or weather scripts to react instantly without hardcoded polling.'
    ]
  },
  {
    stepNumber: 21,
    title: 'Dynamic Weather, Rain Particles & Reduced Tire Friction',
    category: 'Environment',
    whatToCreate: 'WeatherManager with an overhead rain particle emitter and dynamic WheelCollider friction reduction curve on wet asphalt.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Environment_Container > Weather',
    gameObjectsRequired: [
      'WeatherManager (GameObject with WeatherManager.cs attached)',
      '└── RainParticleSystem (Particle system parented to FollowCamera with box shape and downward velocity)'
    ],
    componentsToAdd: [
      {
        targetObject: 'WeatherManager',
        component: 'WeatherManager.cs',
        settings: {
          'Wet Friction Multiplier': '0.55 (45% tire grip loss)',
          'Player Car': 'Car_Player'
        }
      },
      {
        targetObject: 'RainParticleSystem',
        component: 'ParticleSystem',
        settings: {
          'Rate over Time': '1500 particles/sec',
          'Start Speed': '18 m/s downward',
          'Shape': 'Box (X: 30, Y: 10, Z: 30)'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Wet Friction Multiplier', type: 'float', value: '0.55', notes: 'Simulates reduced grip on wet asphalt' },
      { field: 'Player Car', type: 'CarController', value: 'Drag Car_Player from Hierarchy' }
    ],
    scriptFileName: 'WeatherManager.cs',
    howToConnect: [
      'Create child GameObject "WeatherManager" and attach WeatherManager.cs.',
      'Create child Particle System "RainParticleSystem" positioned 15m above ground, parented to Main Camera.',
      'Assign Car_Player into the Player Car reference field.'
    ],
    howToTest: [
      'Switch Scenario to Rain: Rain particle system starts playing.',
      'Accelerate car and attempt sharp steering at 50 km/h: Notice noticeable front wheel understeer and longer braking stopping distances due to 0.55 tire stiffness.'
    ],
    proTips: [
      'Parenting the rain particle box to the camera gives the illusion of infinite world rain with only 1,500 active particles, keeping frame rates at a steady 60+ FPS.'
    ]
  },
  {
    stepNumber: 22,
    title: 'Night Lighting, Street Lamps & Vehicle Headlights',
    category: 'Vehicle',
    whatToCreate: 'Dual spotlight headlights on Car_Player with toggle binding (Key "H") and street lamppost point lights.',
    whereToCreate: 'Car_Player > Headlights and RoadNetwork > StreetLamps',
    gameObjectsRequired: [
      'Car_Player > Headlights (Empty parent with VehicleHeadlights.cs)',
      '├── Spotlight_Left (Spot Light: Range 35m, Spot Angle 45 deg, Color #FFF8E7)',
      '├── Spotlight_Right (Spot Light: Range 35m, Spot Angle 45 deg, Color #FFF8E7)',
      '└── HeadlightLenses (Two small cubes with white emissive material)',
      'StreetLamps (Container of 8 lampposts along road with Point Lights: Range 18m, Color Warm Amber)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Car_Player/Headlights',
        component: 'VehicleHeadlights.cs',
        settings: { 'Toggle Key': 'KeyCode.H', 'Start On': 'False' }
      }
    ],
    inspectorConfiguration: [
      { field: 'Spotlight Left & Right', type: 'Light', value: 'Spot Light (Range 35, Intensity 3.0, Angle 45)' },
      { field: 'Toggle Key', type: 'KeyCode', value: 'KeyCode.H' }
    ],
    scriptFileName: 'VehicleHeadlights.cs',
    howToConnect: [
      'Create child "Headlights" under Car_Player.',
      'Add 2 Spot Lights positioned at front bumper (Z: +1.8, Y: +0.6, X: +/-0.65).',
      'Attach VehicleHeadlights.cs and assign spotlights and lens renderers.'
    ],
    howToTest: [
      'Switch Scenario to Night: Scene dims to dark midnight blue.',
      'Press "H" key: Headlights turn on, casting two bright beam cones onto the road.',
      'Press "H" key again: Headlights turn off.'
    ],
    proTips: [
      'In Night mode, driving without headlights in later assessments can be detected as an unsafe driving violation.'
    ]
  },
  {
    stepNumber: 23,
    title: 'Kinematic AI Traffic Vehicles & Obstacle Avoidance',
    category: 'Environment',
    whatToCreate: 'Kinematic AI traffic cars following route waypoints on cross street, stopping for red lights, and triggering collision penalties on impact.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > TrafficVehicles',
    gameObjectsRequired: [
      'TrafficVehicles (Empty Parent)',
      '├── TrafficCar_01 (Prefab: Chassis cube, 4 wheels, BoxCollider, Rigidbody [isKinematic = true], Tag = "Obstacle")',
      '└── TrafficWaypoints_EastWest (Empty parent with 4 waypoint transforms spanning cross street)'
    ],
    componentsToAdd: [
      {
        targetObject: 'TrafficCar_01',
        component: 'TrafficVehicleController.cs',
        settings: {
          'Cruise Speed Kmh': '35',
          'Forward Sensor Distance': '10',
          'Loop Waypoints': 'True'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Cruise Speed Kmh', type: 'float', value: '35.0', notes: 'Moderate speed across junction' },
      { field: 'Forward Sensor Distance', type: 'float', value: '10.0', notes: 'Brakes if obstacle or player is detected ahead' },
      { field: 'GameObject Tag', type: 'string', value: '"Obstacle"', notes: 'Crucial for CollisionMonitor detection' }
    ],
    scriptFileName: 'TrafficVehicleController.cs',
    howToConnect: [
      'Create TrafficCar_01 with Rigidbody (isKinematic = true) and BoxCollider.',
      'Set Tag to "Obstacle".',
      'Attach TrafficVehicleController.cs and drag waypoints from cross street into Waypoints array.'
    ],
    howToTest: [
      'Hit Play: Traffic car cruises smoothly along cross street.',
      'Park your player car in front of traffic car: It stops 10m away without ramming you.',
      'Deliberately hit the traffic car: CollisionMonitor detects impact and deducts 20 points.'
    ],
    proTips: [
      'Using Rigidbody.isKinematic = true avoids unpredictable physics glitches when multiple AI cars interact, while still allowing full collision detection.'
    ]
  },
  {
    stepNumber: 24,
    title: 'Crosswalk Pedestrian Hazards & Emergency Braking',
    category: 'Environment',
    whatToCreate: 'Pedestrian crossing crosswalk at intersection, pausing at curbs and acting as dynamic collision obstacle.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Pedestrians',
    gameObjectsRequired: [
      'Pedestrians (Empty Parent)',
      '├── Pedestrian_Crosswalk (Capsule: Height 1.8, Radius 0.35, Tag = "Obstacle", CapsuleCollider)',
      '├── Waypoint_Curb_East (Transform at eastern sidewalk)',
      '└── Waypoint_Curb_West (Transform at western sidewalk)'
    ],
    componentsToAdd: [
      {
        targetObject: 'Pedestrian_Crosswalk',
        component: 'PedestrianController.cs',
        settings: {
          'Walk Speed': '1.4 m/s',
          'Pause at Curb Duration': '3.0 s'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Walk Speed', type: 'float', value: '1.4', notes: 'Standard human walking pace' },
      { field: 'Pause At Curb Duration', type: 'float', value: '3.0', notes: 'Waits before returning across' },
      { field: 'GameObject Tag', type: 'string', value: '"Obstacle"' }
    ],
    scriptFileName: 'PedestrianController.cs',
    howToConnect: [
      'Create 3D Capsule named "Pedestrian_Crosswalk" at intersection crosswalk.',
      'Set Tag = "Obstacle".',
      'Attach PedestrianController.cs and drag Curb_East and Curb_West into Curb A and Curb B slots.'
    ],
    howToTest: [
      'Hit Play: Pedestrian crosses zebra stripes at 1.4 m/s, pauses at sidewalk for 3s, and walks back.',
      'Stop car before crosswalk: Pedestrian crosses safely.',
      'Drive across without stopping: Collision triggers if contact is made (-20 pts).'
    ],
    proTips: [
      'In Phase 5 assessments, failing to yield to a pedestrian in a crosswalk can trigger dedicated unsafe driving penalties.'
    ]
  },
  {
    stepNumber: 25,
    title: 'Telemetry Stream Logger & Kinematic Sensor Engine',
    category: 'Management',
    whatToCreate: 'Attach TelemetryManager.cs to collect 10 Hz time-series telemetry (timestamp, speed km/h, acceleration m/s², throttle, brake, steer, position, speed limit).',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > GameManager',
    gameObjectsRequired: [
      'GameManager (Existing manager with TelemetryManager.cs attached)',
      'Car_Player (Source Rigidbody and CarController component)'
    ],
    componentsToAdd: [
      {
        targetObject: 'GameManager',
        component: 'TelemetryManager.cs',
        settings: {
          'Sample Rate Hz': '10.0 (samples/second)',
          'Hard Braking Threshold': '-6.5 m/s²',
          'Aggressive Accel Threshold': '4.8 m/s²',
          'Player Car': 'Car_Player'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Sample Rate Hz', type: 'float', value: '10.0', notes: 'High enough for precision without memory bloating' },
      { field: 'Hard Braking Threshold', type: 'float', value: '-6.5', notes: 'Longitudinal deceleration limit in m/s²' },
      { field: 'Aggressive Accel Threshold', type: 'float', value: '4.8', notes: 'Excessive forward surge from standing start' }
    ],
    scriptFileName: 'TelemetryManager.cs',
    howToConnect: [
      'Select GameManager in the Hierarchy.',
      'Add Component > TelemetryManager.cs.',
      'Drag Car_Player into the Player Car and Rigidbody slots.',
      'Verify the script initializes singleton Instance in Awake().'
    ],
    howToTest: [
      'Enter Play Mode and drive the vehicle for 10 seconds.',
      'Inspect GameManager in the Inspector: Records count increases by ~10 records per second.',
      'Verify max speed, total distance, and sample arrays update accurately.'
    ],
    proTips: [
      'TelemetryManager exposes ExportTelemetryCsv(), allowing immediate data export to standard CSV format for academic graphing or external regression analysis.'
    ]
  },
  {
    stepNumber: 26,
    title: 'Driving Score & Configurable Penalty Deduction Engine',
    category: 'Management',
    whatToCreate: 'DrivingScoreManager enforcing starting score of 100, configurable penalty deductions, and performance tier classifications.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > GameManager',
    gameObjectsRequired: [
      'GameManager (Existing manager with DrivingScoreManager.cs attached)'
    ],
    componentsToAdd: [
      {
        targetObject: 'GameManager',
        component: 'DrivingScoreManager.cs',
        settings: {
          'Starting Score': '100',
          'Collision Penalty': '20',
          'Red Light Penalty': '15',
          'Wrong Lane Penalty': '10',
          'Overspeed Penalty': '5',
          'Missed Checkpoint Penalty': '5',
          'Hard Braking Penalty': '3'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Starting Score', type: 'int', value: '100', notes: 'Academic baseline score' },
      { field: 'Collision Penalty', type: 'int', value: '20', notes: 'Major physical collision deduction' },
      { field: 'Red Light Penalty', type: 'int', value: '15', notes: 'Stop-line breach on red signal' },
      { field: 'Wrong Lane Penalty', type: 'int', value: '10', notes: 'Oncoming lane drift penalty' },
      { field: 'Overspeed Penalty', type: 'int', value: '5', notes: 'Exceeding posted zone limit' },
      { field: 'Hard Braking Penalty', type: 'int', value: '3', notes: 'Abrupt deceleration deduction' }
    ],
    scriptFileName: 'DrivingScoreManager.cs',
    howToConnect: [
      'Attach DrivingScoreManager.cs to GameManager.',
      'Ensure starting score is set to 100.',
      'Connect ViolationManager and TelemetryManager events to DrivingScoreManager penalty methods.'
    ],
    howToTest: [
      'Hit Play: Initial score is 100 (Classification: Excellent).',
      'Crash into roadside barrier: Score drops to 80 (Classification: Good).',
      'Commit red light violation: Score drops to 65 (Classification: Needs Improvement).',
      'Commit another infraction: Score drops below 60 (Classification: Unsafe Driving).'
    ],
    proTips: [
      'All deductions are exposed as Inspector serialized fields, satisfying college lab requirements for calibrating grading rubrics.'
    ]
  },
  {
    stepNumber: 27,
    title: 'Kinematic Sensors: Hard Braking & Aggressive Acceleration',
    category: 'Vehicle',
    whatToCreate: 'Real-time numerical derivative sensors in TelemetryManager detecting abrupt braking (> 6.5 m/s² deceleration) and aggressive acceleration (> 4.8 m/s²).',
    whereToCreate: 'Handled continuously inside TelemetryManager.cs FixedUpdate/Update routine.',
    gameObjectsRequired: ['Car_Player', 'GameManager'],
    componentsToAdd: [],
    inspectorConfiguration: [
      { field: 'Hard Braking Threshold', type: 'float', value: '-6.5', notes: 'G-force threshold equivalent to ~0.66G' },
      { field: 'Min Speed for Hard Braking', type: 'float', value: '15.0 km/h', notes: 'Filters out low-speed parking stops' }
    ],
    howToConnect: [
      'In TelemetryManager, calculate acceleration = (currentSpeed - previousSpeed) / dt.',
      'If acceleration < -6.5 m/s² while speed > 15 km/h, trigger OnHardBrakingDetected event.',
      'In DrivingScoreManager, listen to OnHardBrakingDetected and apply -3 point deduction.'
    ],
    howToTest: [
      'Accelerate car to 60 km/h and slam down the Spacebar (Handbrake) or S key.',
      'Verify: TelemetryManager logs "⚠️ Hard Braking Detected: -7.2 m/s²" in Console.',
      'Verify: Score deducts 3 points and HUD displays Hard Braking warning banner.'
    ],
    proTips: [
      'Filtering by speed > 15 km/h prevents false alarms when gently coming to a complete standstill at traffic lights.'
    ]
  },
  {
    stepNumber: 28,
    title: 'Explainable Natural Language Feedback Generator',
    category: 'Management',
    whatToCreate: 'FeedbackManager synthesizes human-readable evaluation narratives detailing driver strengths, infractions, and actionable improvement recommendations.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > GameManager',
    gameObjectsRequired: [
      'GameManager (Existing manager with FeedbackManager.cs attached)'
    ],
    componentsToAdd: [
      {
        targetObject: 'GameManager',
        component: 'FeedbackManager.cs',
        settings: {
          'Score Manager': 'DrivingScoreManager',
          'Telemetry Manager': 'TelemetryManager'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Score Manager', type: 'DrivingScoreManager', value: 'Drag GameManager' },
      { field: 'Telemetry Manager', type: 'TelemetryManager', value: 'Drag GameManager' }
    ],
    scriptFileName: 'FeedbackManager.cs',
    howToConnect: [
      'Attach FeedbackManager.cs to GameManager.',
      'Wire the Score Manager and Telemetry Manager references.',
      'Call GenerateReport() upon reaching destination or pressing "Assess" button.'
    ],
    howToTest: [
      'Complete a drive where you exceeded speed limit twice and braked hard once.',
      'Call FeedbackManager.GenerateReport().',
      'Verify generated summary: "Your overall lane control was good, but you exceeded the speed limit 2 times. Braked sharply 1 time before intersections."'
    ],
    proTips: [
      'Explainable feedback ensures student drivers learn why they lost marks rather than just seeing an opaque numeric score.'
    ]
  },
  {
    stepNumber: 29,
    title: 'Driver Assessment UI, G-Force Meter & Session Evaluation Drawer',
    category: 'UI',
    whatToCreate: 'AssessmentUI canvas modal showing final score (0-100), color-coded tier badge, penalty breakdown, explainable narrative, and CSV export button.',
    whereToCreate: 'Assets/Scenes/DrivingScene.unity > Hierarchy > Canvas > AssessmentModal',
    gameObjectsRequired: [
      'Canvas > AssessmentModal (Panel with AssessmentUI.cs attached)',
      '├── Header (Title, Score, Tier Badge with color background)',
      '├── SummaryCard (Executive feedback narrative text)',
      '├── DetailsGrid (Strengths list, Infractions list, Recommendations)',
      '└── ActionButtons (Restart Drive, Export CSV, Close)'
    ],
    componentsToAdd: [
      {
        targetObject: 'AssessmentModal',
        component: 'AssessmentUI.cs',
        settings: {
          'Assessment Panel': 'AssessmentModal',
          'Score Text': 'Txt_FinalScore',
          'Tier Badge Text': 'Txt_TierBadge'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'Assessment Panel', type: 'GameObject', value: 'AssessmentModal' },
      { field: 'Score Text', type: 'TMP_Text', value: 'Txt_FinalScore' },
      { field: 'Summary Text', type: 'TMP_Text', value: 'Txt_ExecutiveSummary' },
      { field: 'Export CSV Button', type: 'Button', value: 'Btn_ExportCsv' }
    ],
    scriptFileName: 'AssessmentUI.cs',
    howToConnect: [
      'Create UI Panel named AssessmentModal under Canvas.',
      'Attach AssessmentUI.cs and connect all text and button fields.',
      'In CheckpointManager or RouteHUD, trigger AssessmentUI.ShowReport() when destination is cleared.'
    ],
    howToTest: [
      'Drive across all checkpoints to the destination parking bay.',
      'Assessment modal opens automatically with final score, tier badge, and full explainable report.',
      'Click "Export CSV": Telemetry log file is written to disk.'
    ],
    proTips: [
      'Keep the modal initially inactive (SetActive(false)) in Awake() so it does not obstruct the camera view during live driving.'
    ]
  },
  {
    stepNumber: 30,
    title: 'Driver Profile Manager & Multi-Student Roster Architecture',
    category: 'Management',
    whatToCreate: 'Persistent profile system tracking driver credentials, student ID, license progression tier, lifetime driving time, and cumulative safety records.',
    whereToCreate: 'Hierarchy -> Create Empty GameObject named "ProfileManager" (or add to existing CoreSystems parent).',
    gameObjectsRequired: ['ProfileManager', 'CoreSystems'],
    componentsToAdd: [
      {
        targetObject: 'ProfileManager',
        component: 'DriverProfileManager (Script)',
        settings: {
          'Default Driver Name': 'Alex Carter',
          'License Tier': 'StudentPermit',
          'Save File Name': 'driver_profiles.json'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'defaultDriverName', type: 'string', value: 'Alex Carter', notes: 'Initial student driver name' },
      { field: 'licenseTier', type: 'DriverLicenseTier', value: 'StudentPermit', notes: 'Promotes automatically based on drive count & average score' },
      { field: 'saveFileName', type: 'string', value: 'driver_profiles.json', notes: 'Saved in Application.persistentDataPath' }
    ],
    scriptFileName: 'DriverProfileManager.cs',
    howToConnect: [
      'Attach DriverProfileManager.cs to the ProfileManager GameObject.',
      'Configure DontDestroyOnLoad to ensure profile data persists across scene reloads.',
      'Subscribe UI components to OnProfileChanged and OnProfileUpdated events.'
    ],
    howToTest: [
      'Enter Play Mode. Check console log: "[DriverProfileManager] Active profile switched to: Alex Carter".',
      'Call CreateNewProfile("Jordan Lee") in Inspector or script; verify file driver_profiles.json is written to persistentDataPath.'
    ],
    proTips: [
      'Use JsonUtility with pretty-print enabled so student data can be easily inspected or verified during academic grading.'
    ]
  },
  {
    stepNumber: 31,
    title: 'Session Telemetry & Violation JSON Serialization Engine',
    category: 'Management',
    whatToCreate: 'Complete lifecycle session logger recording timestamps, duration, distance, average/max speeds, violation counts, and saving to JSON.',
    whereToCreate: 'Hierarchy -> Create Empty GameObject named "SessionManager" under CoreSystems.',
    gameObjectsRequired: ['SessionManager', 'CoreSystems'],
    componentsToAdd: [
      {
        targetObject: 'SessionManager',
        component: 'SessionManager (Script)',
        settings: {
          'Session History File Name': 'driving_sessions_history.json',
          'Max Stored Sessions': '100'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'sessionHistoryFileName', type: 'string', value: 'driving_sessions_history.json', notes: 'Stores full historical records' },
      { field: 'maxStoredSessions', type: 'int', value: '100', notes: 'Rolling cap to optimize memory and file size' }
    ],
    scriptFileName: 'SessionManager.cs',
    howToConnect: [
      'Attach SessionManager.cs to the SessionManager GameObject.',
      'Call SessionManager.Instance.StartNewSession(activeScenarioName) when starting a drive.',
      'In AssessmentUI or CheckpointManager, trigger SessionManager.Instance.FinalizeAndSaveSession() when reaching the destination.'
    ],
    howToTest: [
      'Complete a route in the City scenario.',
      'Observe console log: "[SessionManager] Session SESS-XXXX saved with score XX/100."',
      'Inspect Application.persistentDataPath to confirm driving_sessions_history.json contains the formatted session record.'
    ],
    proTips: [
      'SessionManager updates distance incrementally per frame using Vector3.Distance to prevent odometer jumps or teleport artifacts.'
    ]
  },
  {
    stepNumber: 32,
    title: 'Results Engine, Analytics Aggregation & Personal Score Deltas',
    category: 'Management',
    whatToCreate: 'Analytical calculation system that computes pass rates, historical average speeds, most frequent violation categories, and pairwise session comparisons.',
    whereToCreate: 'Hierarchy -> Create Empty GameObject named "ResultsManager" under CoreSystems.',
    gameObjectsRequired: ['ResultsManager', 'CoreSystems'],
    componentsToAdd: [
      {
        targetObject: 'ResultsManager',
        component: 'ResultsManager (Script)',
        settings: {
          'Target Passing Score': '75'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'targetPassingScore', type: 'int', value: '75', notes: 'Academic passing threshold for certification' }
    ],
    scriptFileName: 'ResultsManager.cs',
    howToConnect: [
      'Attach ResultsManager.cs to the ResultsManager GameObject.',
      'Provide ComputeDriverAnalytics(driverId) and CompareSessions(sessionA, sessionB) to DriverDashboardUI and Results UI.'
    ],
    howToTest: [
      'Execute two consecutive drives (one with 0 infractions, one with an intentional collision).',
      'Verify ResultsManager returns scoreDelta = -20 and progressVerdict indicating performance regression.'
    ],
    proTips: [
      'The most frequent infraction calculation automatically identifies whether the driver struggles more with speed limits, red lights, or lane drift.'
    ]
  },
  {
    stepNumber: 33,
    title: 'Interactive Driver Dashboard UI Canvas & Career Stats Hub',
    category: 'UI',
    whatToCreate: 'Full-screen dashboard canvas presenting active driver details, career driving stats (Total Drives, Average Score, Best Score, Pass Rate), and scrollable session history log.',
    whereToCreate: 'Hierarchy -> Canvas -> Create Panel named "DriverDashboardCanvas".',
    gameObjectsRequired: ['DriverDashboardCanvas', 'Txt_DriverName', 'Txt_LicenseBadge', 'Txt_CareerDrives', 'Txt_AvgScore', 'SessionScrollContent', 'Btn_CloseDashboard'],
    componentsToAdd: [
      {
        targetObject: 'DriverDashboardCanvas',
        component: 'DriverDashboardUI (Script)',
        settings: {
          'Dashboard Canvas': 'DriverDashboardCanvas',
          'Driver Name Text': 'Txt_DriverName',
          'License Tier Text': 'Txt_LicenseBadge',
          'Career Drives Text': 'Txt_CareerDrives',
          'Avg Score Text': 'Txt_AvgScore',
          'Session List Container': 'SessionScrollContent'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'dashboardCanvas', type: 'GameObject', value: 'DriverDashboardCanvas', notes: 'Toggled via Dashboard HUD button' },
      { field: 'driverNameText', type: 'TMP_Text', value: 'Txt_DriverName', notes: 'Bound to ActiveProfile.driverName' },
      { field: 'sessionCardPrefab', type: 'GameObject', value: 'SessionLogCardPrefab', notes: 'Instantiated for each historical session' }
    ],
    scriptFileName: 'DriverDashboardUI.cs',
    howToConnect: [
      'Link TMP_Text references to the Inspector fields on DriverDashboardUI.',
      'Add a "Driver Dashboard" button to the main HUD or pause menu that calls DriverDashboardUI.ShowDashboard().',
      'Hook the Close button to DriverDashboardUI.HideDashboard().'
    ],
    howToTest: [
      'Click the "Driver Dashboard" button on screen or press F2.',
      'The full-screen dashboard reveals career summary numbers and lists past session records with exact timestamps, scores, and infractions.'
    ],
    proTips: [
      'Ensure the SessionScrollContent uses a Vertical Layout Group and Content Size Fitter so cards scroll smoothly regardless of how many drives are recorded.'
    ]
  },
  {
    stepNumber: 34,
    title: 'Historical Progression Tracking & Multi-Session Comparison Testing',
    category: 'Testing',
    whatToCreate: 'End-to-end integration and verification harness testing driver identity switching, persistent disk loading after restart, and pairwise session comparison accuracy.',
    whereToCreate: 'Scene Test Hierarchy -> Integration Verification.',
    gameObjectsRequired: ['CoreSystems', 'Canvas', 'ProfileManager', 'SessionManager', 'ResultsManager'],
    componentsToAdd: [
      {
        targetObject: 'CoreSystems',
        component: 'Integration Verification Suite',
        settings: {
          'Persistence Path': 'Application.persistentDataPath',
          'Test Scenarios': 'City, Highway, Rain, Night'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'targetPassingScore', type: 'int', value: '75', notes: 'Required score for driver tier advancement' }
    ],
    howToConnect: [
      'Ensure all 4 Phase 6 managers (Profile, Session, Results, Dashboard) are instantiated.',
      'Verify that restarting Unity play mode restores previous drive history from disk without corruption.'
    ],
    howToTest: [
      'Drive a complete session in City scenario -> Observe score saved to history.',
      'Switch profile to a secondary trainee -> Confirm statistics reset to that trainee profile.',
      'Stop Play Mode and hit Play again -> Verify persistent data loads from disk intact.'
    ],
    proTips: [
      'Check the console for any JSON deserialization warnings; ensure classes tagged with [Serializable] have public fields or [SerializeField].'
    ]
  },
  {
    stepNumber: 35,
    title: 'Procedural Vehicle Audio System & Dynamic RPM Pitch Engine',
    category: 'Audio',
    whatToCreate: 'Dynamic acoustic system modulating engine RPM pitch/volume, triggering tire squeal on lateral drift or hard braking, and playing crash impacts and blinker clicks.',
    whereToCreate: 'Car GameObject -> Add AudioSource components & VehicleAudio.cs script.',
    gameObjectsRequired: ['Car', 'Audio_Engine', 'Audio_TireSqueal', 'Audio_CrashImpact', 'Audio_TurnSignal'],
    componentsToAdd: [
      {
        targetObject: 'Car',
        component: 'VehicleAudio (Script)',
        settings: {
          'Idle Pitch': '0.75',
          'Top Pitch': '2.40',
          'Idle Volume': '0.40',
          'Tire Slip Threshold': '0.35'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'engineSource', type: 'AudioSource', value: 'Car/Audio_Engine', notes: 'Spatial 3D blend = 1.0, Looping = true' },
      { field: 'tireSquealSource', type: 'AudioSource', value: 'Car/Audio_TireSqueal', notes: 'Volume dynamically scales with lateral slip' },
      { field: 'collisionClip', type: 'AudioClip', value: 'SFX_MetalImpact', notes: 'One-shot impact triggered on OnCollisionEnter' },
      { field: 'blinkerTickClip', type: 'AudioClip', value: 'SFX_IndicatorTick', notes: 'Periodic relay tick sound when Q or E is active' }
    ],
    scriptFileName: 'VehicleAudio.cs',
    howToConnect: [
      'Attach VehicleAudio.cs to the primary Car GameObject alongside CarController.',
      'Create child GameObjects for AudioSources to keep spatial audio listeners cleanly organized.',
      'Assign engine loop clip, tire screech clip, and collision impact clips in the Inspector.'
    ],
    howToTest: [
      'Accelerate vehicle from 0 to 80 km/h: Engine pitch seamlessly climbs from 0.75x to 2.2x.',
      'Hit Spacebar at 50 km/h: Tire screech audio smoothly blends in during the deceleration skid.',
      'Collide with a traffic barrier: Impact audio triggers with volume scaled to collision velocity.'
    ],
    proTips: [
      'Set AudioSource Doppler Level to 0.3-0.5 to avoid unnatural pitch warping when switching camera views rapidly.'
    ]
  },
  {
    stepNumber: 36,
    title: 'Visual Effects, Cockpit Steering Animation & Emissive Lights',
    category: 'Visuals',
    whatToCreate: 'Interactive cockpit steering column rotation, HDR emissive brake light glowing, reverse tail lamps, and synchronized turn signal indicator blinkers.',
    whereToCreate: 'Car GameObject -> Interior & Exterior Light Transforms.',
    gameObjectsRequired: ['Car', 'SteeringWheel_Mesh', 'TailLights', 'LeftBlinkerLights', 'RightBlinkerLights'],
    componentsToAdd: [
      {
        targetObject: 'Car',
        component: 'VehicleVisualEffects (Script)',
        settings: {
          'Max Steering Angle': '450',
          'Steer Response Speed': '12',
          'Blink Cycle Seconds': '0.45'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'interiorSteeringWheel', type: 'Transform', value: 'Car/Cockpit/SteeringWheel', notes: 'Rotates around Z-axis matching horizontal steer axis' },
      { field: 'brakeLightRenderers', type: 'Renderer[]', value: 'Car/Body/TailLight_Left, TailLight_Right', notes: 'Applies HDR emission boost when braking' },
      { field: 'leftBlinkers', type: 'GameObject[]', value: 'Left turn signal light sources', notes: 'Toggled via Q key' },
      { field: 'rightBlinkers', type: 'GameObject[]', value: 'Right turn signal light sources', notes: 'Toggled via E key' }
    ],
    scriptFileName: 'VehicleVisualEffects.cs',
    howToConnect: [
      'Attach VehicleVisualEffects.cs to the Car GameObject.',
      'Assign interior steering wheel transform and configure rear tail light mesh renderers.',
      'Verify that brake light material uses Standard Shader with Emission enabled.'
    ],
    howToTest: [
      'Switch to 1st-person cockpit camera (C key) and turn left/right: Steering wheel rotates smoothly up to 450 degrees.',
      'Tap brakes or handbrake: Rear tail lights flare with intense HDR red emission.',
      'Press Q or E: Corresponding amber blinkers pulse on and off at 0.45s cadence.'
    ],
    proTips: [
      'Use MaterialPropertyBlock or instantiate a local material instance in Awake() to avoid permanently altering project asset materials on disk during runtime.'
    ]
  },
  {
    stepNumber: 37,
    title: 'Academic Laboratory Report Exporter & Rubric Certification Engine',
    category: 'Reporting',
    whatToCreate: 'Formal driving competency certification engine producing academic grading certificates (A+ to F), 4-pillar rubric breakdown, SHA-256 digital validation checksum, and styled HTML/PDF export.',
    whereToCreate: 'Hierarchy -> Create Empty GameObject named "LabReportExporter" under CoreSystems.',
    gameObjectsRequired: ['LabReportExporter', 'CoreSystems'],
    componentsToAdd: [
      {
        targetObject: 'LabReportExporter',
        component: 'LabReportExporter (Script)',
        settings: {
          'Institution Name': 'Automotive Simulation & Safety Laboratory',
          'Examiner Title': 'Certified Sim-Lab Safety Examiner',
          'Passing Threshold': '75'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'institutionName', type: 'string', value: 'Automotive Simulation & Safety Laboratory', notes: 'Institution header printed on certificate' },
      { field: 'examinerTitle', type: 'string', value: 'Certified Sim-Lab Safety Examiner', notes: 'Examiner accreditation credential' },
      { field: 'passingThreshold', type: 'int', value: '75', notes: 'Pass/Fail threshold grade' }
    ],
    scriptFileName: 'LabReportExporter.cs',
    howToConnect: [
      'Attach LabReportExporter.cs to the CoreSystems hierarchy.',
      'Connect LabReportExporter.Instance.GenerateCertificate(session, profile) to AssessmentUI and DriverDashboardUI.',
      'Add "Export Academic Certificate" button to post-drive summary screens.'
    ],
    howToTest: [
      'Finish a drive in any scenario -> Open Assessment or Dashboard UI.',
      'Click "Export Academic Lab Certificate": HTML report is written to Application.persistentDataPath.',
      'Open the HTML certificate in a web browser: Clean academic styling displays student details, letter grade, and SHA-256 validation hash.'
    ],
    proTips: [
      'The generated HTML report uses self-contained inline CSS, allowing direct printing to PDF via standard browser Ctrl+P without broken external styling.'
    ]
  },
  {
    stepNumber: 38,
    title: 'End-to-End Driving Lab Verification & Standalone Build Polish',
    category: 'Testing',
    whatToCreate: 'Comprehensive full-laboratory end-to-end audit: Physics integrity, multi-camera transitions, rule enforcement, weather adaptation, telemetry logging, profile persistence, dynamic audio, and academic certification.',
    whereToCreate: 'Unity Editor -> Build Settings & Standalone Player.',
    gameObjectsRequired: ['All Scene Entities & CoreSystems'],
    componentsToAdd: [
      {
        targetObject: 'ProjectSettings',
        component: 'Standalone Player Build Suite',
        settings: {
          'Target Platform': 'PC, Mac & Linux Standalone',
          'Architecture': 'x86_64',
          'V-Sync Count': 'Every V-Blank (60 FPS locked)'
        }
      }
    ],
    inspectorConfiguration: [
      { field: 'File > Build Settings > Scenes In Build', type: 'Scenes', value: 'MainMenu.unity (0), DrivingScene.unity (1)', notes: 'Verified clean scene pipeline' },
      { field: 'Project Settings > Audio > DSP Buffer Size', type: 'enum', value: 'Best Latency', notes: 'Eliminates audio stutter on engine pitch changes' },
      { field: 'Project Settings > Quality > Anti-Aliasing', type: 'enum', value: '4x Multi-Sampling', notes: 'Crisp road lines and intersection markings' }
    ],
    howToConnect: [
      'Verify zero compiler warnings and zero runtime null reference exceptions across all 7 project phases.',
      'Execute full student evaluation run from Main Menu to destination parking bay.',
      'Validate that the resulting academic dossier satisfies all project specifications.'
    ],
    howToTest: [
      'Launch standalone build: Verify Main Menu loads smoothly.',
      'Click Start Driving: Test vehicle acceleration, steering, braking, multi-camera switching, audio modulation, scenario change, and post-drive certificate generation.',
      'Confirm all 7 phases operate harmoniously with 60+ FPS stability.'
    ],
    proTips: [
      'Lock framerate using Application.targetFrameRate = 60 in GameManager.Awake() to ensure deterministic WheelCollider physics across all hardware tiers.'
    ]
  }
];


export const PHASE_1_CHECKLIST = [
  { id: 'c1', label: 'Main Menu works properly with Project Title ("Car Driving Simulator")', requirement: 'Main Menu' },
  { id: 'c2', label: 'Start Driving button transitions to Driving Scene cleanly', requirement: 'Scene Flow' },
  { id: 'c3', label: 'Exit button functional (calls Application.Quit / stops play mode)', requirement: 'Main Menu' },
  { id: 'c4', label: 'Driving scene contains Ground, Straight Road, Lane Markings, Roadside Objects, Directional Light', requirement: 'Environment' },
  { id: 'c5', label: 'Vehicle accelerates forward using W / Up Arrow', requirement: 'Vehicle Control' },
  { id: 'c6', label: 'Vehicle brakes when pressing S / Down Arrow while moving forward', requirement: 'Vehicle Control' },
  { id: 'c7', label: 'Vehicle transitions to Reverse gear when stopped and pressing S / Down Arrow', requirement: 'Vehicle Control' },
  { id: 'c8', label: 'Front wheels steer smoothly using A / D or Left / Right Arrows', requirement: 'Vehicle Control' },
  { id: 'c9', label: 'Handbrake (Spacebar) locks rear wheels with high brake torque', requirement: 'Vehicle Control' },
  { id: 'c10', label: 'Car stays stable without flipping due to lowered Center of Mass', requirement: 'Physics Stability' },
  { id: 'c11', label: 'Third-person FollowCamera tracks behind car with smooth position & rotation damping', requirement: 'Camera' },
  { id: 'c12', label: 'Speedometer HUD calculates and displays actual Rigidbody velocity in km/h', requirement: 'Speedometer' },
  { id: 'c13', label: 'HUD displays current Drive (D) / Reverse (R) / Park (P) transmission gear indicator', requirement: 'HUD' },
  { id: 'c14', label: 'Pause functionality works via Escape key and on-screen button (freezes Time.timeScale)', requirement: 'Pause System' },
  { id: 'c15', label: 'Zero console errors, clean modular C# architecture in 5 separate scripts', requirement: 'Code Quality' }
];

export const PHASE_2_CHECKLIST = [
  { id: 'p2_1', label: '4-Way road intersection connected with dual lanes and crosswalks', requirement: 'Road Network' },
  { id: 'p2_2', label: 'Regulatory speed limit signs (50 km/h, 30 km/h) placed along roadside', requirement: 'Signs' },
  { id: 'p2_3', label: 'Stop sign positioned before intersection stop line', requirement: 'Signs' },
  { id: 'p2_4', label: 'Physical traffic light gantry with 3-aspect illuminated lenses (Red/Yellow/Green)', requirement: 'Signals' },
  { id: 'p2_5', label: 'Sequential route checkpoints with trigger colliders and visual color change', requirement: 'Checkpoints' },
  { id: 'p2_6', label: 'CheckpointManager enforces ordered progression and logs cleared gates', requirement: 'Navigation' },
  { id: 'p2_7', label: 'Destination zone trigger detects final parking completion', requirement: 'Destination' },
  { id: 'p2_8', label: 'First-person interior cockpit camera positioned at driver eye level', requirement: 'Multi-Camera' },
  { id: 'p2_9', label: 'Dashboard / hood camera giving close-up forward road view', requirement: 'Multi-Camera' },
  { id: 'p2_10', label: 'CameraManager allows toggling all 3 camera modes via "C" key and HUD button', requirement: 'Multi-Camera' },
  { id: 'p2_11', label: 'RouteHUD displays active camera view mode, checkpoint progress, and distance', requirement: 'HUD' },
  { id: 'p2_12', label: 'Existing Phase 1 vehicle physics and FollowCamera remain fully intact and operational', requirement: 'Compatibility' }
];

export const PHASE_3_CHECKLIST = [
  { id: 'p3_1', label: 'SpeedLimitZone trigger volume enforces 50 km/h with 3 km/h tolerance buffer', requirement: 'Speed Zones' },
  { id: 'p3_2', label: 'Overspeed detection fires violation penalty (-5 pts) after 2-second grace period', requirement: 'Speed Rules' },
  { id: 'p3_3', label: 'Stop-line sensor detects unauthorized crossing during Red signal phase (-15 pts)', requirement: 'Signal Rules' },
  { id: 'p3_4', label: 'CollisionMonitor detects physical impacts with obstacles and barriers (-20 pts)', requirement: 'Collision Rules' },
  { id: 'p3_5', label: 'Debounce filter prevents multiple collision penalties on a single sustained crash', requirement: 'Physics Filter' },
  { id: 'p3_6', label: 'LaneMonitor detects sustained driving in opposite oncoming traffic lane (-10 pts)', requirement: 'Lane Rules' },
  { id: 'p3_7', label: 'ViolationManager aggregates all violation events and calculates live driving score from 100', requirement: 'Violation Engine' },
  { id: 'p3_8', label: 'All penalty point values are Inspector-configurable without modifying C# logic', requirement: 'Configurability' },
  { id: 'p3_9', label: 'ViolationHUD renders real-time alert popups and dynamic score counter (Score: XX / 100)', requirement: 'HUD Alerts' },
  { id: 'p3_10', label: 'Score text dynamically color-codes: Green (≥90), Sky Blue (≥75), Amber (≥60), Red (<60)', requirement: 'Score Tiers' },
  { id: 'p3_11', label: 'Decoupled event architecture: Zero modification of Phase 1 vehicle controller scripts', requirement: 'Architecture' },
  { id: 'p3_12', label: 'Compilation without errors, clean logs, and seamless compatibility with Phase 1 & 2', requirement: 'Quality' }
];

export const PHASE_4_CHECKLIST = [
  { id: 'p4_1', label: 'ScenarioManager dynamically switches between 4 presets: City, Highway, Rain, and Night', requirement: 'Scenarios' },
  { id: 'p4_2', label: 'City scenario configures clear daylight, urban 50 km/h limit, and active pedestrian crossings', requirement: 'City Scenario' },
  { id: 'p4_3', label: 'Highway scenario configures high-visibility sun, distance fog, and open-road transit', requirement: 'Highway Scenario' },
  { id: 'p4_4', label: 'Rain scenario triggers overhead rain particle system and reduced atmospheric visibility', requirement: 'Rain Scenario' },
  { id: 'p4_5', label: 'WeatherManager dynamically reduces WheelCollider tire friction stiffness by 45% (0.55)', requirement: 'Wet Grip' },
  { id: 'p4_6', label: 'Wet road friction simulates longer braking distances and cornering slip realistically', requirement: 'Vehicle Handling' },
  { id: 'p4_7', label: 'Night scenario sets low ambient lighting (0.08 intensity) with dark midnight atmosphere', requirement: 'Night Scenario' },
  { id: 'p4_8', label: 'VehicleHeadlights component enables dual spotlight beams and glowing lenses via "H" key', requirement: 'Headlights' },
  { id: 'p4_9', label: 'Kinematic AI traffic vehicles cruise along cross-street routes with forward raycast sensors', requirement: 'AI Traffic' },
  { id: 'p4_10', label: 'Traffic cars yield to blocked paths and trigger -20 pt collision penalty on player impact', requirement: 'Traffic Hazard' },
  { id: 'p4_11', label: 'Pedestrians cross at intersection zebra crosswalks, pausing at curbs as dynamic hazards', requirement: 'Pedestrians' },
  { id: 'p4_12', label: 'Zero regression: Phase 1 physics, Phase 2 checkpoints, and Phase 3 violations stay 100% functional', requirement: 'Compatibility' }
];

export const PHASE_5_CHECKLIST = [
  { id: 'p5_1', label: 'TelemetryManager continuously records timestamp, speed, acceleration, throttle, brake, steer, position, and speed limit at 10 Hz', requirement: 'Telemetry Stream' },
  { id: 'p5_2', label: 'Kinematic sensor calculates longitudinal acceleration and detects hard braking events (< -6.5 m/s²)', requirement: 'Hard Braking' },
  { id: 'p5_3', label: 'Kinematic sensor detects aggressive acceleration surges (> 4.8 m/s²) from standstill', requirement: 'Aggressive Accel' },
  { id: 'p5_4', label: 'DrivingScoreManager enforces academic baseline starting from 100 points', requirement: 'Scoring Engine' },
  { id: 'p5_5', label: 'Penalty structure is Inspector-configurable: Collision (-20), Red Light (-15), Wrong Lane (-10), Overspeed (-5), Missed Checkpoint (-5), Hard Braking (-3)', requirement: 'Configurable Rubric' },
  { id: 'p5_6', label: 'Live driver classification maps accurately: 90–100 Excellent, 75–89 Good, 60–74 Needs Improvement, <60 Unsafe Driving', requirement: 'Driver Tiers' },
  { id: 'p5_7', label: 'FeedbackManager generates transparent natural language executive summaries rather than only an opaque numeric score', requirement: 'Explainable AI' },
  { id: 'p5_8', label: 'Feedback synthesizes positive driving behaviors (zero collisions, red-light compliance, smooth braking, correct lane maintenance)', requirement: 'Strengths' },
  { id: 'p5_9', label: 'Feedback isolates specific driver infractions (overspeed tallies, hard braking counts, lane drift events, barrier impacts)', requirement: 'Mistakes' },
  { id: 'p5_10', label: 'Feedback delivers actionable, personalized recommendations for student driver skill improvement', requirement: 'Actionable Advice' },
  { id: 'p5_11', label: 'AssessmentUI presents post-drive evaluation report card with colored tier badge, metrics grid, and one-click CSV export', requirement: 'Assessment UI' },
  { id: 'p5_12', label: 'Zero regression across Phase 1 vehicle physics, Phase 2 environment, Phase 3 violations, and Phase 4 scenarios', requirement: 'Compatibility' }
];

export const PHASE_6_CHECKLIST = [
  { id: 'p6_1', label: 'DriverProfileManager maintains active student profile (name, student ID, license tier, registration date)', requirement: 'Profile Architecture' },
  { id: 'p6_2', label: 'Profile tracks lifetime aggregated stats: total drives, total distance (km), drive time (mins), and running average score', requirement: 'Career Aggregates' },
  { id: 'p6_3', label: 'Automatic license tier progression based on verified drive count and average score benchmark (Student -> Provisional -> Class C)', requirement: 'Tier Progression' },
  { id: 'p6_4', label: 'Profiles serialize to clean formatted JSON and persist reliably in Application.persistentDataPath', requirement: 'Disk Persistence' },
  { id: 'p6_5', label: 'SessionManager logs comprehensive session records (timestamp, duration, distance, avg/max speed, score, all violation tallies)', requirement: 'Session Logging' },
  { id: 'p6_6', label: 'Session history persists to driving_sessions_history.json with rolling cap to prevent unbounded disk growth', requirement: 'History Storage' },
  { id: 'p6_7', label: 'ResultsManager calculates student pass rates, lifetime violation distributions, and identifies primary driver weakness', requirement: 'Statistical Analytics' },
  { id: 'p6_8', label: 'Session comparison algorithm computes pairwise deltas (score delta, speed delta, infractions delta) with progression verdict', requirement: 'Pairwise Comparison' },
  { id: 'p6_9', label: 'DriverDashboardUI displays interactive career stat cards, student profile switcher, and scrollable past session cards', requirement: 'Dashboard UI' },
  { id: 'p6_10', label: 'Session history allows filtering by scenario (City, Highway, Rain, Night) and sorting by score or recency', requirement: 'Scenario Filters' },
  { id: 'p6_11', label: 'One-click JSON export/import allows students to download their performance dossier or instructors to load test rosters', requirement: 'Data Export' },
  { id: 'p6_12', label: 'Seamless integration: Drives completed in 3D simulator automatically append to active driver history and update career stats', requirement: 'End-to-End Pipeline' }
];

export const PHASE_7_CHECKLIST = [
  { id: 'p7_1', label: 'VehicleAudio dynamically modulates engine pitch from idle (0.75x) to rev limit (2.40x) linked to vehicle speed & throttle', requirement: 'Engine Audio' },
  { id: 'p7_2', label: 'Tire screech skid audio blends in cleanly during hard braking (> -6.5 m/s²) and aggressive lateral drift', requirement: 'Tire Squeal' },
  { id: 'p7_3', label: 'Collision impact SFX triggers with volume proportional to impact velocity upon obstacle contact', requirement: 'Crash Impacts' },
  { id: 'p7_4', label: 'Turn indicator audio clicks periodically (0.45s cadence) when Q or E turn signals are activated', requirement: 'Signal Clicks' },
  { id: 'p7_5', label: 'Cockpit 1st-person view features animated interior steering wheel rotating up to 450 degrees with steer input', requirement: 'Cockpit Rigging' },
  { id: 'p7_6', label: 'Rear vehicle lights feature HDR emissive glow boosts when applying standard or handbrake', requirement: 'Emissive Lights' },
  { id: 'p7_7', label: 'Animated amber turn signal blinkers pulse with visual lights on vehicle corners', requirement: 'Turn Blinkers' },
  { id: 'p7_8', label: 'LabReportExporter compiles formal Academic Laboratory Competency Certificates with letter grades (A+ to F)', requirement: 'Academic Grading' },
  { id: 'p7_9', label: '4-pillar competency rubric breakdown (Vehicle Handling, Regulatory Adherence, Hazard Awareness, Speed Discipline)', requirement: 'Rubric Matrix' },
  { id: 'p7_10', label: 'Certificate embeds SHA-256 digital validation checksum ensuring academic authenticity and integrity', requirement: 'Security Hash' },
  { id: 'p7_11', label: 'One-click export provides printable self-contained HTML/PDF certificates and JSON grading records', requirement: 'Report Export' },
  { id: 'p7_12', label: 'Full 7-Phase laboratory integration: 100% verified physics, camera views, rules, scenarios, telemetry, dashboard & audio', requirement: 'Production Master' }
];

export interface ProjectPhaseBlueprint {
  phase: number;
  title: string;
  status: 'Completed & Verified' | 'Pending Command ("START PHASE 7")' | 'Planned Future Phase';
  description: string;
  managers: string[];
  deliverables: string[];
}

export const MASTER_PROJECT_PHASES: ProjectPhaseBlueprint[] = [
  {
    phase: 1,
    title: 'Basic Driving Simulator',
    status: 'Completed & Verified',
    description: 'Clean basic 3D vehicle physics with Rigidbody, WheelColliders, FollowCamera, km/h Speedometer, and pause flow.',
    managers: ['CarController.cs', 'VehicleInput.cs', 'FollowCamera.cs', 'SpeedometerUI.cs', 'GameManager.cs'],
    deliverables: ['Main Menu scene', 'Driving scene', 'W/A/S/D & Space controls', 'Stable Center of Mass', 'HUD Speedometer & Gear']
  },
  {
    phase: 2,
    title: 'Driving Environment & Multi-Camera System',
    status: 'Completed & Verified',
    description: 'Road network with 4-way intersection, crosswalks, speed limit & stop signs, physical traffic signals, route checkpoints, destination, and 3-mode camera rig (1st-person cockpit, 3rd-person chase, dashboard).',
    managers: ['CameraManager.cs', 'Checkpoint.cs', 'CheckpointManager.cs', 'TrafficSignalGantry.cs', 'RouteHUD.cs'],
    deliverables: ['Intersection & road network', 'Signs & traffic signal gantry', 'Sequential checkpoints & destination trigger', '1st-person / 3rd-person / Dashboard camera switcher', 'Route HUD with distance readout']
  },
  {
    phase: 3,
    title: 'Traffic Rules & Violation Engine',
    status: 'Completed & Verified',
    description: 'Autonomous detection of overspeeding, red-light running, collisions, wrong-lane driving, missed checkpoints, and real-time score penalties from 100 base score.',
    managers: ['SpeedLimitZone.cs', 'TrafficSignalTrigger.cs', 'CollisionMonitor.cs', 'LaneMonitor.cs', 'ViolationManager.cs', 'ViolationHUD.cs'],
    deliverables: ['Speed limit collider zones (50 km/h)', 'Red light stop-line sensor', 'Collision impact listeners', 'Lane boundary sensors', '100 Base Score & Configurable Penalties: -20 Collision, -15 Red Light, -10 Wrong Lane, -5 Overspeed, -5 Checkpoint, -3 Hard Braking', 'Real-time alert banner HUD']
  },
  {
    phase: 4,
    title: 'Training Scenarios & Dynamic Conditions',
    status: 'Completed & Verified',
    description: 'City, Highway, Rain, and Night training scenarios with AI traffic cars, pedestrian crossings, headlights, and wet surface friction.',
    managers: ['ScenarioManager.cs', 'WeatherManager.cs', 'TrafficVehicleController.cs', 'PedestrianController.cs'],
    deliverables: ['City & Highway presets', 'Rain weather particles & reduced tire friction', 'Night lighting & functional vehicle headlights', 'Simple deterministic traffic & pedestrian hazard triggers']
  },
  {
    phase: 5,
    title: 'Driver Behaviour Assessment & Explainable Feedback',
    status: 'Completed & Verified',
    description: 'Continuous telemetry capture (throttle, brake, steer, speed, G-force) and explainable natural language feedback generation.',
    managers: ['TelemetryManager.cs', 'DrivingScoreManager.cs', 'FeedbackManager.cs', 'AssessmentUI.cs'],
    deliverables: ['Telemetry time-series logger (10 Hz)', 'Starting 100 score engine', 'Driver tier classification (90-100: Excellent, 75-89: Good, 60-74: Needs Improvement, <60: Unsafe)', 'Explainable natural language narrative generator', 'Strengths, infractions & recommendations report', 'CSV telemetry export']
  },
  {
    phase: 6,
    title: 'Driver Dashboard & Progress Storage',
    status: 'Completed & Verified',
    description: 'Driver profile, historical session logging, statistical aggregates (best/average scores, common violations), and comprehensive post-drive results page.',
    managers: ['DriverProfileManager.cs', 'SessionManager.cs', 'ResultsManager.cs', 'DriverDashboardUI.cs'],
    deliverables: ['Driver profile records & roster switching', 'Post-drive career analytics card', 'Score progression history & pass rate analytics', 'History persistence (JSON/PlayerPrefs/localStorage)', 'Multi-session pairwise comparison engine']
  },
  {
    phase: 7,
    title: 'Final Refinement, Audio & Academic Reporting',
    status: 'Completed & Verified',
    description: 'Dynamic RPM engine sounds, tire squeal, indicator clicks, polished cockpit visuals, HDR lighting, robust error boundaries, and exportable lab evaluation report.',
    managers: ['VehicleAudio.cs', 'VehicleVisualEffects.cs', 'LabReportExporter.cs'],
    deliverables: ['Dynamic RPM engine audio & pitch modulation', 'Tire squeal & collision crash audio effects', 'Cockpit steering wheel animation & HDR brake glow', 'Academic lab evaluation certificate & PDF/HTML export', 'Cryptographic SHA-256 evaluation validation', 'All 7 Laboratory Phases Complete']
  }
];


export const PENALTY_MATRIX = [
  { violation: 'Collision with Vehicle / Obstacle', deduction: -20, severity: 'Critical', trigger: 'OnCollisionEnter with tagged obstacles' },
  { violation: 'Red-Light Signal Violation', deduction: -15, severity: 'High', trigger: 'Crossing intersection stop line during Red phase' },
  { violation: 'Wrong-Lane / Opposite Traffic Lane', deduction: -10, severity: 'Medium-High', trigger: 'Exceeding opposite lane boundary for > 1.5 seconds' },
  { violation: 'Overspeeding beyond Zone Limit', deduction: -5, severity: 'Medium', trigger: 'Speed > SpeedLimit + tolerance for > 2.0 seconds' },
  { violation: 'Missed Navigation Checkpoint', deduction: -5, severity: 'Medium', trigger: 'Bypassing required route sequence checkpoint' },
  { violation: 'Hard / Aggressive Braking', deduction: -3, severity: 'Low-Medium', trigger: 'Deceleration rate > 6.5 m/s² without emergency cause' }
];

export const CLASSIFICATION_TIERS = [
  { tier: 'Excellent', range: '90 – 100', color: '#10b981', badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', summary: 'Safe, predictable driving with smooth pedal control and full traffic regulation adherence.' },
  { tier: 'Good', range: '75 – 89', color: '#38bdf8', badgeClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30', summary: 'Generally cautious driving with minor speed variances or occasional late braking.' },
  { tier: 'Needs Improvement', range: '60 – 74', color: '#f59e0b', badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30', summary: 'Repeated minor infractions, abrupt speed fluctuations, or lane indiscipline.' },
  { tier: 'Unsafe Driving', range: 'Below 60', color: '#ef4444', badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30', summary: 'Severe safety risks: collisions, red light crossings, or uncontrolled speeds.' }
];

