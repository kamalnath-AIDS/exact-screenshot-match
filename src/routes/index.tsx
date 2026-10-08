import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/features/pages";
import { PageFrame } from "@/components/indiclive-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IndicLive — Real-time Indian-language captions" },
      { name: "description", content: "A real-time communication bridge for Indian languages, built around stable streaming captions and honest latency measurement." },
      { property: "og:title", content: "IndicLive — Real-time Indian-language captions" },
      { property: "og:description", content: "A real-time communication bridge for Indian languages, built around stable streaming captions and honest latency measurement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PageFrame><HomePage /></PageFrame>,
});