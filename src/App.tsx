import React, { Suspense, lazy, useEffect, useState } from "react";
const ThreeCanvas = lazy(() =>
  import("./components/ThreeCanvas").then((module) => ({
    default: module.ThreeCanvas,
  })),
);
const DriverDashboard = lazy(() =>
  import("./components/DriverDashboard").then((module) => ({
    default: module.DriverDashboard,
  })),
);
import {
  ArrowUpRight,
  ArrowRight,
  CarFront,
  LayoutDashboard,
  Gamepad2,
  BarChart3,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";

const pages = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Your driving practice workspace.",
  },
  {
    id: "sandbox",
    label: "Driving simulator",
    icon: Gamepad2,
    description:
      "Choose a scenario, get behind the wheel, and review your drive.",
  },
  {
    id: "dashboard",
    label: "Driver performance",
    icon: BarChart3,
    description: "Review sessions, compare results, and track your progress.",
  },
] as const;
type Page = (typeof pages)[number]["id"];
const validPage = (value: string): value is Page =>
  pages.some((page) => page.id === value);

export default function App() {
  const [activeTab, setActiveTab] = useState<Page>(() => {
    const value = window.location.hash.slice(1);
    return validPage(value) ? value : "overview";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (page: Page) => {
    window.location.hash = page;
    setActiveTab(page);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const sync = () => {
      const value = window.location.hash.slice(1);
      setActiveTab(validPage(value) ? value : "overview");
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const page = pages.find((item) => item.id === activeTab)!;
  useEffect(() => {
    document.title = `${page.label} · PDL Drive`;
  }, [page.label]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <span className="brand-mark">
            <CarFront size={24} />
          </span>
          <span>
            PDL <b>Drive</b>
            <small>YOUR DRIVING PRACTICE</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {pages.map((item) => (
            <React.Fragment key={item.id}>
              <button
                onClick={() => navigate(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {activeTab === item.id && <span className="nav-dot" />}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> Your progress, saved
          <p>Practice sessions and progress stay on this device.</p>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="mobile-menu"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="breadcrumb">
              Practice <span>/</span> <strong>{page.label}</strong>
            </span>
          </div>
          <span className="local-badge">
            <span className="status-dot" /> Saved on this device
          </span>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {activeTab === "overview"
                  ? "PRACTICE. REVIEW. IMPROVE."
                  : "PDL DRIVE / PRACTICE"}
              </p>
              <h1>
                {activeTab === "overview"
                  ? "Every good drive starts here."
                  : page.label}
              </h1>
              <p>{page.description}</p>
            </div>
            {activeTab !== "sandbox" && (
              <button
                className="primary-button"
                onClick={() => navigate("sandbox")}
              >
                Start a drive <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          {activeTab === "overview" && (
            <>
              <section className="drive-hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <span className="status-dot" /> INTERACTIVE DRIVING LAB
                  </span>
                  <h2>
                    Build confidence.
                    <br />
                    One drive at a time.
                  </h2>
                  <p>
                    Practice vehicle control in four driving environments. Get a
                    clear breakdown of your session and know what to work on
                    next.
                  </p>
                  <button
                    className="hero-button"
                    onClick={() => navigate("sandbox")}
                  >
                    Open simulator <ArrowRight size={18} />
                  </button>
                  <span className="hero-hint">
                    Keyboard controls · Live telemetry · Session reports
                  </span>
                </div>
                <div className="track-art">
                  <svg
                    viewBox="0 0 500 360"
                    role="img"
                    aria-label="Illustration of a driving practice circuit"
                  >
                    <defs>
                      <pattern
                        id="grid"
                        width="30"
                        height="30"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 30 0 L 0 0 0 30"
                          fill="none"
                          stroke="#ffffff"
                          strokeOpacity=".07"
                        />
                      </pattern>
                    </defs>
                    <rect width="500" height="360" fill="url(#grid)" />
                    <path
                      d="M135 90 H345 Q405 90 405 150 V240 Q405 285 350 285 H160 Q100 285 100 225 V150 Q100 90 135 90Z"
                      fill="none"
                      stroke="#375c55"
                      strokeWidth="65"
                    />
                    <path
                      d="M135 90 H345 Q405 90 405 150 V240 Q405 285 350 285 H160 Q100 285 100 225 V150 Q100 90 135 90Z"
                      fill="none"
                      stroke="#a4bfb1"
                      strokeWidth="2"
                      strokeDasharray="9 9"
                    />
                    <path d="M230 55 V125" stroke="#e8e8d8" strokeWidth="6" />
                    <rect
                      x="269"
                      y="71"
                      width="43"
                      height="25"
                      rx="7"
                      fill="#e4bc72"
                    />
                    <rect
                      x="278"
                      y="75"
                      width="15"
                      height="17"
                      rx="3"
                      fill="#1c3933"
                    />
                    <circle cx="100" cy="210" r="10" fill="#a4bfb1" />
                    <circle cx="100" cy="210" r="4" fill="#163c35" />
                    <text
                      x="175"
                      y="193"
                      fill="#b2c9bf"
                      fontSize="12"
                      letterSpacing="4"
                    >
                      PDL TEST CIRCUIT
                    </text>
                    <text
                      x="24"
                      y="336"
                      fill="#8faea2"
                      fontSize="11"
                      letterSpacing="2"
                    >
                      01 / CITY PRACTICE
                    </text>
                    <path
                      d="M440 310v-30m-7 8 7-8 7 8"
                      stroke="#b2c9bf"
                      fill="none"
                    />
                    <text x="435" y="328" fill="#b2c9bf" fontSize="11">
                      N
                    </text>
                  </svg>
                </div>
              </section>
              <div className="overview-facts">
                <div>
                  <span>04</span>
                  <p>
                    Driving environments
                    <small>City, highway, rain & night</small>
                  </p>
                </div>
                <div>
                  <span>100</span>
                  <p>
                    Starting score<small>Event-based penalty deductions</small>
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    Camera views<small>Chase, cockpit & hood</small>
                  </p>
                </div>
              </div>
              <div className="section-heading">
                <h2>A place for every part of practice</h2>
                <span>YOUR WORKSPACE</span>
              </div>
              <section className="quick-grid">
                {[
                  {
                    title: "Get behind the wheel",
                    body: "Choose your conditions and practice steering, braking, and road awareness.",
                    page: "sandbox" as Page,
                    icon: Gamepad2,
                    label: "Start practicing",
                    number: "01",
                  },
                  {
                    title: "Understand your drive",
                    body: "Review your session history, spot recurring mistakes, and compare attempts.",
                    page: "dashboard" as Page,
                    icon: BarChart3,
                    label: "View performance",
                    number: "02",
                  },
                  {
                    title: "Practice road awareness",
                    body: "Read signals, check your mirror, and share the road with traffic and pedestrians.",
                    page: "sandbox" as Page,
                    icon: ShieldCheck,
                    label: "Choose a route",
                    number: "03",
                  },
                ].map((card) => (
                  <button
                    className="quick-card"
                    key={card.number}
                    onClick={() => navigate(card.page)}
                  >
                    <div className="card-top">
                      <card.icon size={22} />
                      <span>{card.number}</span>
                    </div>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                    <span className="card-link">
                      {card.label}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </section>
              <div className="workspace-notice">
                <ShieldCheck size={20} />
                <p>
                  <strong>Make every session count.</strong> Follow the route,
                  respect speed limits, and stop in the marked bay. Review your
                  driving events after each attempt. Sample driver records are
                  included in performance reports.
                </p>
              </div>
            </>
          )}
          <Suspense
            fallback={
              <div className="data-notice" role="status">
                Loading workspace…
              </div>
            }
          >
            {activeTab === "sandbox" && (
              <>
                <ThreeCanvas
                  onNavigateToDashboard={() => navigate("dashboard")}
                />
              </>
            )}
            {activeTab === "dashboard" && (
              <>
                <div className="data-notice">
                  Includes sample records. New practice sessions are saved
                  locally; exported reports are simulation results.
                </div>
                <DriverDashboard
                  onNavigateToSandbox={() => navigate("sandbox")}
                />
              </>
            )}
          </Suspense>
        </main>
        <footer className="workspace-footer">
          <span>PDL Drive · Driving practice</span>
          <span>Practice at your own pace</span>
        </footer>
      </div>
    </div>
  );
}
