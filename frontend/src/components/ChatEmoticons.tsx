import { useEffect } from "react";
import "./chat-emoticons.css";

const MESSAGE_SELECTOR = [
  ".random-message-bubble p",
  ".room-message-bubble p",
  ".direct-message-bubble",
  ".friend-row-copy > small"
].join(",");

const BUBBLE_SELECTOR = [
  ".random-message-bubble",
  ".room-message-bubble",
  ".direct-message-bubble"
].join(",");

const EMOJI_BY_TOKEN: Record<string, string> = {
  ":)": "🙂",
  ":-):": "🙂",
  ":-)": "🙂",
  ":d": "😄",
  ":-d": "😄",
  ";)": "😉",
  ";-)": "😉",
  ":(": "🙁",
  ":-(": "🙁",
  ":'(": "😢",
  ":-'(": "😢",
  ":p": "😛",
  ":-p": "😛",
  ":x": "🤐",
  ":-x": "🤐",
  ":o": "😮",
  ":-o": "😮",
  ":/": "😕",
  ":-/": "😕",
  "<3": "❤️",
  "xd": "😂"
};

const EMOTICON_PATTERN = /(^|[\s([{\"'“”‘’—–])(:-'\(|:'\(|:-\)|:\)|:-d|:d|;-\)|;\)|:-\(|:\(|:-p|:p|:-x|:x|:-o|:o|:-\/|:\/|<3|xd)(?=$|[\s.,!?;:)\]}\"'“”‘’—–])/gi;
const EMOJI_ONLY_PATTERN = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u;

export function convertChatEmoticons(value: string) {
  return value.replace(EMOTICON_PATTERN, (match, prefix: string, token: string) => {
    const emoji = EMOJI_BY_TOKEN[token.toLocaleLowerCase("pl-PL")];
    return emoji ? `${prefix}${emoji}` : match;
  });
}

function convertTextNodes(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const current = node.nodeValue || "";
    const converted = convertChatEmoticons(current);
    if (converted !== current) node.nodeValue = converted;
  }
}

function updateEmojiOnlyState(element: HTMLElement) {
  const bubble = element.matches(BUBBLE_SELECTOR)
    ? element
    : element.closest<HTMLElement>(BUBBLE_SELECTOR);

  if (!bubble) return;
  const text = (bubble.textContent || "").trim();
  const emojiOnly = Boolean(text && text.length <= 32 && EMOJI_ONLY_PATTERN.test(text));
  bubble.classList.toggle("is-emoji-only", emojiOnly);
}

function processMessages(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR).forEach((element) => {
    convertTextNodes(element);
    updateEmojiOnlyState(element);
  });
}

export default function ChatEmoticons() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => processMessages(root));
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
