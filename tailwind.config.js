/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./lib/utils.ts",
    "./lib/mock-data.ts",
    "./components/FeatureCard.tsx",
    "./components/GlassButton.tsx",
    "./components/CollaboratorAvatars.tsx",
    "./components/ChatPanel.tsx",
    "./components/DashboardProjectCarousel.tsx",
    "./components/DemoRoomWorkspace.tsx",
    "./components/EventActivity.tsx",
    "./components/HomepageProductReveal.tsx",
    "./components/Icons.tsx",
    "./components/SphericalCarousel.tsx",
    "./app/page.tsx",
    "./components/Timeline.tsx",
    "./components/WaveformEditor.tsx",
    "./app/layout.tsx",
    "./components/ControlPanel.tsx",
    "./components/TrackList.tsx",
    "./components/RoomCard.tsx",
    "./components/GlassCard.tsx",
    "./components/Navbar.tsx",
    "./app/dashboard/page.tsx",
    "./app/room/demo/page.tsx"
],
  theme: {
    extend: {
      colors: {
        ink: "#101216",
        mist: "#eef1f4",
        graphite: "#20252d",
        sage: "#9fb4aa",
        brass: "#c7aa6a",
        clay: "#b8897d",
      },
      boxShadow: {
        glass: "0 24px 80px rgba(19, 24, 31, 0.18)",
        glow: "0 0 48px rgba(159, 180, 170, 0.26)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont"],
      },
    },
  },
  plugins: [],
};
