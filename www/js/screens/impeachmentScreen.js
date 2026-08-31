import { audioManager } from "../core/audioManager.js";
import { attachCollapseToggle } from "../ui/overlayCollapse.js";
import NavigationService from "../core/navigation.js";

const IMPEACHMENT_VIDEO_SRC = "assets/impeachment/impeachment.mp4";

export function showImpeachmentScreen(root, { onRetry, onMenu }) {
  const overlay = document.createElement("div");
  overlay.id = "impeachment-screen";

  const statsContainer = document.createElement("div");
  statsContainer.className = "win-stats";

  const title = document.createElement("div");
  title.className = "impeachment-title";
  title.textContent = "Коты объявили вам ИМПИЧМЕНТ!!!";

  const subtitle = document.createElement("div");
  subtitle.className = "win-stat-value";
  subtitle.textContent = "Уровень не пройден";
  subtitle.style.marginTop = "8px";
  subtitle.style.textAlign = "center";

  statsContainer.appendChild(title);
  statsContainer.appendChild(subtitle);

  const videoWrap = document.createElement("div");
  videoWrap.className = "impeachment-video-wrap";

  const video = document.createElement("video");
  video.className = "impeachment-video";
  video.controls = true;
  video.playsInline = true;
  video.src = IMPEACHMENT_VIDEO_SRC;

  video.addEventListener("loadeddata", () => {
    video.play().catch(() => {});
  });

  videoWrap.appendChild(video);

  const btns = document.createElement("div");
  btns.className = "impeachment-btns";
  btns.style.gap = "10px";
  btns.style.justifyContent = "center";

  const retry = document.createElement("button");
  retry.className = "win-btn";
  retry.textContent = "Попробовать снова";
  retry.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.closeModal();
    overlay.remove();
    onRetry();
  });

  const menu = document.createElement("button");
  menu.className = "win-btn";
  menu.textContent = "К выбору уровня";
  menu.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.closeModal();
    overlay.remove();
    onMenu();
  });

  btns.appendChild(retry);
  btns.appendChild(menu);

  overlay.appendChild(statsContainer);
  overlay.appendChild(videoWrap);
  overlay.appendChild(btns);
  root.appendChild(overlay);

  NavigationService.openModal();

  // Hardware/browser back button while this modal is open:
  // same action as "К выбору уровня" button
  NavigationService.setOnModalBack(() => {
    overlay.remove();
    NavigationService.closeModal();
    onMenu();
  });

  attachCollapseToggle(root, overlay, {
    icon: "⚠️",
    label: "Импичмент",
    onCollapse: () => video.pause(),
    onExpand: () => video.play().catch(() => {})
  });
}
