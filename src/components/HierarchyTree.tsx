import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Box, Camera, Video, Monitor, Settings, Compass, Sliders } from 'lucide-react';

interface HierarchyNode {
  id: string;
  name: string;
  type: 'root' | 'child' | 'leaf';
  icon: string;
  components: {
    name: string;
    properties: Record<string, string>;
  }[];
  transform: {
    position: string;
    rotation: string;
    scale: string;
  };
  children?: HierarchyNode[];
}

const HIERARCHY_DATA: HierarchyNode[] = [
  {
    id: 'car-player',
    name: 'Car_Player',
    type: 'root',
    icon: 'box',
    transform: { position: 'X: 0, Y: 0.8, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      {
        name: 'Rigidbody',
        properties: {
          'Mass': '1400',
          'Drag': '0.05',
          'Angular Drag': '2.5',
          'Use Gravity': 'True',
          'Interpolate': 'Interpolate',
          'Collision Detection': 'Continuous'
        }
      },
      {
        name: 'VehicleInput (Script)',
        properties: {
          'Horizontal Axis': '"Horizontal"',
          'Vertical Axis': '"Vertical"',
          'Handbrake Key': 'KeyCode.Space'
        }
      },
      {
        name: 'CarController (Script)',
        properties: {
          'Front Left Collider': 'Wheel_FL_Collider (WheelCollider)',
          'Front Right Collider': 'Wheel_FR_Collider (WheelCollider)',
          'Rear Left Collider': 'Wheel_RL_Collider (WheelCollider)',
          'Rear Right Collider': 'Wheel_RR_Collider (WheelCollider)',
          'Front Left Transform': 'Wheel_FL_Mesh (Transform)',
          'Front Right Transform': 'Wheel_FR_Mesh (Transform)',
          'Rear Left Transform': 'Wheel_RL_Mesh (Transform)',
          'Rear Right Transform': 'Wheel_RR_Mesh (Transform)',
          'Max Motor Torque': '1600 Nm',
          'Max Brake Torque': '3200 Nm',
          'Handbrake Torque': '6500 Nm',
          'Max Steer Angle': '32°',
          'Max Forward Speed': '130 km/h',
          'Center Of Mass Offset': '(0, -0.55, 0.2)'
        }
      }
    ],
    children: [
      {
        id: 'car-visual',
        name: 'CarBody_Visual',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
        components: [
          { name: 'MeshRenderer', properties: { 'Material': 'Mat_CarBlue (Smoothness 0.7)' } }
        ]
      },
      {
        id: 'colliders-parent',
        name: 'Colliders',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
        components: [
          {
            name: 'BoxCollider',
            properties: {
              'Center': 'X: 0, Y: 0.45, Z: 0',
              'Size': 'X: 1.8, Y: 0.8, Z: 4.2',
              'Is Trigger': 'False'
            }
          }
        ]
      },
      {
        id: 'wheel-colliders-parent',
        name: 'WheelColliders',
        type: 'child',
        icon: 'sliders',
        transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
        components: [],
        children: [
          {
            id: 'wc-fl',
            name: 'Wheel_FL_Collider',
            type: 'leaf',
            icon: 'sliders',
            transform: { position: 'X: -0.85, Y: 0.35, Z: 1.3', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
            components: [
              {
                name: 'WheelCollider',
                properties: {
                  'Mass': '25 kg',
                  'Radius': '0.35 m',
                  'Suspension Distance': '0.2 m',
                  'Spring': '35000',
                  'Damper': '4500',
                  'Target Position': '0.5'
                }
              }
            ]
          },
          {
            id: 'wc-fr',
            name: 'Wheel_FR_Collider',
            type: 'leaf',
            icon: 'sliders',
            transform: { position: 'X: 0.85, Y: 0.35, Z: 1.3', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
            components: [{ name: 'WheelCollider', properties: { 'Radius': '0.35 m', 'Spring': '35000', 'Damper': '4500' } }]
          },
          {
            id: 'wc-rl',
            name: 'Wheel_RL_Collider',
            type: 'leaf',
            icon: 'sliders',
            transform: { position: 'X: -0.85, Y: 0.35, Z: -1.3', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
            components: [{ name: 'WheelCollider', properties: { 'Radius': '0.35 m', 'Spring': '35000', 'Damper': '4500' } }]
          },
          {
            id: 'wc-rr',
            name: 'Wheel_RR_Collider',
            type: 'leaf',
            icon: 'sliders',
            transform: { position: 'X: 0.85, Y: 0.35, Z: -1.3', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
            components: [{ name: 'WheelCollider', properties: { 'Radius': '0.35 m', 'Spring': '35000', 'Damper': '4500' } }]
          }
        ]
      },
      {
        id: 'wheel-meshes-parent',
        name: 'WheelMeshes',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
        components: [],
        children: [
          {
            id: 'wm-fl',
            name: 'Wheel_FL_Mesh',
            type: 'leaf',
            icon: 'box',
            transform: { position: 'X: -0.85, Y: 0.35, Z: 1.3', rotation: 'X: 0, Y: 0, Z: 90', scale: 'X: 0.7, Y: 0.12, Z: 0.7' },
            components: [{ name: 'MeshFilter & MeshRenderer', properties: { 'Mesh': 'Cylinder', 'Material': 'Mat_Tire' } }]
          },
          { id: 'wm-fr', name: 'Wheel_FR_Mesh', type: 'leaf', icon: 'box', transform: { position: 'X: 0.85, Y: 0.35, Z: 1.3', rotation: 'X: 0, Y: 0, Z: 90', scale: 'X: 0.7, Y: 0.12, Z: 0.7' }, components: [] },
          { id: 'wm-rl', name: 'Wheel_RL_Mesh', type: 'leaf', icon: 'box', transform: { position: 'X: -0.85, Y: 0.35, Z: -1.3', rotation: 'X: 0, Y: 0, Z: 90', scale: 'X: 0.7, Y: 0.12, Z: 0.7' }, components: [] },
          { id: 'wm-rr', name: 'Wheel_RR_Mesh', type: 'leaf', icon: 'box', transform: { position: 'X: 0.85, Y: 0.35, Z: -1.3', rotation: 'X: 0, Y: 0, Z: 90', scale: 'X: 0.7, Y: 0.12, Z: 0.7' }, components: [] }
        ]
      }
    ]
  },
  {
    id: 'main-camera',
    name: 'Main Camera',
    type: 'root',
    icon: 'camera',
    transform: { position: 'X: 0, Y: 3.5, Z: -6.5', rotation: 'X: 12, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      { name: 'Camera', properties: { 'Field of View': '60', 'Near Clip': '0.1', 'Far Clip': '1000' } },
      {
        name: 'FollowCamera (Script)',
        properties: {
          'Target': 'Car_Player (Transform)',
          'Distance': '6.2 m',
          'Height': '2.5 m',
          'Position Smooth Time': '0.12 s',
          'Rotation Damping': '6.0',
          'Look At Height Offset': '1.0 m'
        }
      }
    ]
  },
  {
    id: 'hud-canvas',
    name: 'HUD_Canvas',
    type: 'root',
    icon: 'monitor',
    transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      { name: 'Canvas', properties: { 'Render Mode': 'Screen Space - Overlay', 'Pixel Perfect': 'True' } },
      { name: 'Canvas Scaler', properties: { 'UI Scale Mode': 'Scale With Screen Size', 'Reference Resolution': '1920 x 1080' } },
      {
        name: 'SpeedometerUI (Script)',
        properties: {
          'Car Controller': 'Car_Player (CarController)',
          'Speed Text': 'Text_Speed (Text)',
          'Gear Text': 'Text_Gear (Text)'
        }
      },
      {
        name: 'RouteHUD (Script - Phase 2)',
        properties: {
          'Camera Mode Text': 'Text_CameraMode (Text)',
          'Checkpoint Progress Text': 'Text_CheckpointProgress (Text)',
          'Distance Next Text': 'Text_DistanceNext (Text)'
        }
      }
    ]
  },
  {
    id: 'camera-manager',
    name: 'CameraManager',
    type: 'root',
    icon: 'camera',
    transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      {
        name: 'CameraManager (Script)',
        properties: {
          'Third Person Camera': 'Main Camera (Camera)',
          'First Person Camera': 'Car_Player/Camera_FirstPerson (Camera)',
          'Dashboard Camera': 'Car_Player/Camera_Dashboard (Camera)',
          'Cycle Camera Key': 'KeyCode.C',
          'Initial Mode': 'ThirdPerson'
        }
      }
    ]
  },
  {
    id: 'route-navigation',
    name: 'Route_Navigation',
    type: 'root',
    icon: 'settings',
    transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      {
        name: 'CheckpointManager (Script)',
        properties: {
          'Player Transform': 'Car_Player (Transform)',
          'Checkpoints Count': '4 sequential gates',
          'Destination Trigger': 'DestinationZone (Collider)'
        }
      }
    ],
    children: [
      {
        id: 'cp-1',
        name: 'Checkpoint_01',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 1.2, Z: 45', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 12, Y: 4, Z: 2' },
        components: [
          { name: 'BoxCollider', properties: { 'Is Trigger': 'True', 'Size': 'X: 12, Y: 4, Z: 2' } },
          { name: 'Checkpoint (Script)', properties: { 'Checkpoint Index': '0', 'Active Color': 'Sky Blue' } }
        ]
      },
      {
        id: 'dest-zone',
        name: 'DestinationZone',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 105, Y: 0.5, Z: 100', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 8, Y: 2, Z: 8' },
        components: [
          { name: 'BoxCollider', properties: { 'Is Trigger': 'True', 'Size': 'X: 8, Y: 2, Z: 8' } }
        ]
      }
    ]
  },
  {
    id: 'road-network',
    name: 'RoadNetwork',
    type: 'root',
    icon: 'box',
    transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [],
    children: [
      {
        id: 'road-main',
        name: 'Road_MainAvenue',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 0.02, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 14, Y: 0.05, Z: 600' },
        components: [{ name: 'BoxCollider', properties: { 'Physic Material': 'Mat_Asphalt' } }]
      },
      {
        id: 'road-cross',
        name: 'Road_CrossStreet',
        type: 'child',
        icon: 'box',
        transform: { position: 'X: 0, Y: 0.022, Z: 100', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 400, Y: 0.05, Z: 14' },
        components: [{ name: 'BoxCollider', properties: { 'Physic Material': 'Mat_Asphalt' } }]
      },
      {
        id: 'traffic-signal-north',
        name: 'TrafficSignal_North',
        type: 'child',
        icon: 'settings',
        transform: { position: 'X: 8.5, Y: 0, Z: 88', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
        components: [
          {
            name: 'TrafficSignalGantry (Script)',
            properties: {
              'Green Duration': '12.0s',
              'Yellow Duration': '3.5s',
              'Red Duration': '10.0s',
              'Current Light': 'Cycling automatically'
            }
          }
        ]
      }
    ]
  },
  {
    id: 'game-manager',
    name: 'GameManager',
    type: 'root',
    icon: 'settings',
    transform: { position: 'X: 0, Y: 0, Z: 0', rotation: 'X: 0, Y: 0, Z: 0', scale: 'X: 1, Y: 1, Z: 1' },
    components: [
      {
        name: 'GameManager (Script)',
        properties: {
          'Main Menu Scene Name': '"MainMenu"',
          'Driving Scene Name': '"DrivingScene"',
          'Pause Menu Panel': 'HUD_Canvas/Panel_Pause (GameObject)'
        }
      }
    ]
  }
];

export const HierarchyTree: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('car-player');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'car-player': true,
    'wheel-colliders-parent': true,
    'wheel-meshes-parent': false
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Find selected node recursively
  const findNode = (nodes: HierarchyNode[], id: string): HierarchyNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = findNode(HIERARCHY_DATA, selectedNodeId) || HIERARCHY_DATA[0];

  const renderNode = (node: HierarchyNode, depth = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => setSelectedNodeId(node.id)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center gap-1.5 py-1.5 pr-3 rounded cursor-pointer text-xs transition-colors ${
            isSelected ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {hasChildren ? (
            <button
              onClick={e => toggleExpand(node.id, e)}
              className="p-0.5 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4.5" />
          )}

          <Box className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
          <span className="truncate">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Unity Hierarchy Window */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Unity Hierarchy</span>
            <span className="text-[10px] text-slate-500 font-mono">(DrivingScene.unity)</span>
          </div>
          <span className="text-[11px] text-sky-400 font-mono">14 Objects</span>
        </div>

        <div className="py-1 space-y-0.5 max-h-[520px] overflow-y-auto font-mono">
          {HIERARCHY_DATA.map(node => renderNode(node, 0))}
        </div>
      </div>

      {/* Right: Unity Inspector Window */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Unity Inspector</span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-xs font-mono text-sky-400 font-semibold">{selectedNode.name}</span>
          </div>
          <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-400">Static: False</span>
        </div>

        {/* Transform Component */}
        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Transform</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1 text-slate-400">
            <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Position</span>
              <span className="text-slate-200">{selectedNode.transform.position}</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Rotation</span>
              <span className="text-slate-200">{selectedNode.transform.rotation}</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Scale</span>
              <span className="text-slate-200">{selectedNode.transform.scale}</span>
            </div>
          </div>
        </div>

        {/* Attached Components List */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {selectedNode.components.map((c, i) => (
            <div key={i} className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded bg-blue-500 inline-block" />
                  {c.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Component</span>
              </div>

              {Object.keys(c.properties).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
                  {Object.entries(c.properties).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center py-0.5 border-b border-slate-800/40">
                      <span className="text-slate-400 text-[11px] font-sans">{k}:</span>
                      <span className="text-amber-300 text-[11px]">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic">Default component properties.</span>
              )}
            </div>
          ))}

          {selectedNode.components.length === 0 && (
            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/40 text-xs text-slate-500 italic">
              Empty container GameObject (grouping parent).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
