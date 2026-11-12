// 공용 선 아이콘 (이모지 대신 UI에 사용) — fi('home') → <svg>
const FI = {
 "home": "<path d=\"M3 11l9-7 9 7\"/><path d=\"M5 10v10h14V10\"/><path d=\"M10 20v-6h4v6\"/>",
 "calendar": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>",
 "wallet": "<path d=\"M3 7a2 2 0 0 1 2-2h12v4\"/><rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M16 13.5h2\"/>",
 "image": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"M21 15l-5-5L5 21\"/>",
 "plane": "<path d=\"M10.5 13.5L3 11l1.5-1.5 8 1 4-4.5c1-1 2.6-1.4 3.2-.8s.2 2.2-.8 3.2l-4.5 4 1 8L14 21.5l-2.5-7.5\"/><path d=\"M6 17l-2 .5 1.5 1.5\"/>",
 "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18\"/>",
 "chat": "<path d=\"M4 5h16v11H9l-5 4z\"/>",
 "cart": "<circle cx=\"9\" cy=\"20\" r=\"1.5\"/><circle cx=\"17\" cy=\"20\" r=\"1.5\"/><path d=\"M3 4h2l2.4 11h11L21 8H6.2\"/>",
 "target": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/>",
 "news": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 8h10M7 12h10M7 16h6\"/>",
 "settings": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/>",
 "logout": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><path d=\"M16 17l5-5-5-5M21 12H9\"/>",
 "menu": "<path d=\"M4 6h16M4 12h16M4 18h16\"/>",
 "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
 "refresh": "<path d=\"M3 12a9 9 0 0 1 15.5-6.3L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-15.5 6.3L3 16\"/><path d=\"M3 21v-5h5\"/>",
 "help": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7\"/><path d=\"M12 17h.01\"/>",
 "send": "<path d=\"M4 12l16-8-6 16-2.5-6.5z\"/><path d=\"M11.5 13.5L20 4\"/>",
 "chart": "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>",
 "list": "<path d=\"M9 6h11M9 12h11M9 18h11\"/><path d=\"M4 6h.01M4 12h.01M4 18h.01\"/>",
 "back": "<path d=\"M15 18l-6-6 6-6\"/>",
 "camera": "<path d=\"M4 8h3l2-3h6l2 3h3v11H4z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>",
 "mic": "<rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"/>",
 "book": "<path d=\"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z\"/><path d=\"M4 19V5\"/>",
 "swap": "<path d=\"M7 4v16M7 4L3 8M7 4l4 4\"/><path d=\"M17 20V4M17 20l-4-4M17 20l4-4\"/>"
};
function fi(n, cls) { return '<svg class="fi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (FI[n] || '') + '</svg>'; }
