export default function manifest() {
  return {
    name: "I Legal - Indian Law Assistant",
    short_name: "I Legal",
    description: "Ask about Indian laws, sections and your legal rights.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f6f3",
    theme_color: "#3f7d73",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}