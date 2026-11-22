/**
 * JS que pasa una página de la hoja (pedal, `04-directo.md` §8). Si la hoja
 * está maquetada en páginas (`__SONG_LAYOUT__`, pantalla completa «atril»),
 * usa la suya; si no, desplaza una pantalla. Ya en el borde, avisa a la app
 * con `{ type: edgeType, dir }` para que pase de canción.
 */
export function pedalPageScript(dir: 1 | -1, edgeType: string): string {
  return `(function(){var d=${dir};var L=window.__SONG_LAYOUT__;if(L&&L.page&&L.page(d))return true;var el=document.scrollingElement||document.documentElement;var max=el.scrollHeight-window.innerHeight;var y=window.scrollY;if((d>0&&y>=max-4)||(d<0&&y<=4)){var m=JSON.stringify({type:${JSON.stringify(edgeType)},dir:d});if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage)window.ReactNativeWebView.postMessage(m);else if(window.parent&&window.parent!==window)window.parent.postMessage(m,'*');}else{window.scrollBy({top:d*window.innerHeight*0.85,behavior:'smooth'});}return true;})();`;
}
