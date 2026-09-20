const phone = document.querySelector('.phone');
const phoneViewport = matchMedia(
  '(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 500px)',
);
function fitPhone() {
  const viewport = window.visualViewport;
  const width = Math.min(window.innerWidth, viewport?.width ?? window.innerWidth);
  const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
  const scale = Math.min(1, width / 393, height / 852);
  phone.style.width = (phoneViewport.matches ? width / scale : 393) + 'px';
  phone.style.height = (phoneViewport.matches ? height / scale : 852) + 'px';
  phone.style.setProperty('--game-height', phone.style.height);
  phone.style.setProperty('--phone-scale', scale);
  phone.style.left = (viewport?.offsetLeft ?? 0) + width / 2 + 'px';
  phone.style.top = (viewport?.offsetTop ?? 0) + height / 2 + 'px';
}
fitPhone();
window.addEventListener('resize', fitPhone);
phoneViewport.addEventListener('change', fitPhone);
window.visualViewport?.addEventListener('resize', fitPhone);
window.visualViewport?.addEventListener('scroll', fitPhone);
