const DICT = {
  es: {
    app_tagline: 'Mapping y ambientes para proyectores',
    displays: 'Pantallas', no_displays: 'Ninguna pantalla conectada todavía.',
    no_displays_help: 'Abre {url} en el proyector, Google TV o cualquier navegador. También puedes usar este mismo dispositivo:',
    open_here: 'Abrir pantalla aquí', open_second: 'Segunda pantalla', cast: 'Transmitir (Cast)',
    online: 'en línea', offline: 'desconectada', select_display: 'Elige una pantalla',
    scenes: 'Escenas', surfaces: 'Superficies', effect: 'Efecto', masks: 'Zonas', optics: 'Óptica', audio: 'Audio', playlist: 'Programación',
    presets: 'Ambientes incluidos', my_scenes: 'Mis escenas', save_scene: 'Guardar escena actual', scene_name: 'Nombre de la escena',
    apply_content: 'Aplicar (mantener calibración)', apply_full: 'Reemplazar todo', delete: 'Eliminar', rename: 'Renombrar',
    add_surface: 'Añadir superficie', duplicate: 'Duplicar', reset_corners: 'Restablecer esquinas', full_frame: 'Pantalla completa',
    visible: 'Visible', opacity: 'Opacidad', feather: 'Borde suave', blend: 'Mezcla', blend_normal: 'Normal', blend_add: 'Aditiva',
    speed: 'Velocidad', intensity: 'Intensidad', scale: 'Escala', hue: 'Tono', audio_react: 'Reacción al audio', palette: 'Paleta',
    particles: 'Partículas', count: 'Cantidad', size: 'Tamaño', trails: 'Estela',
    media: 'Imagen / video', upload: 'Subir archivo', fit: 'Ajuste', fit_cover: 'Cubrir', fit_contain: 'Contener', fit_stretch: 'Estirar',
    add_mask_rect: 'Zona rectangular', add_mask_circle: 'Zona circular', mask_exclude: 'Proteger (sin luz)', mask_include: 'Solo proyectar aquí',
    masks_help: 'Las zonas protegidas bloquean la luz del proyector: ojos, ventanas, pantallas, cuadros… Arrastra los puntos en la vista previa.',
    add_point: '+ punto', remove_point: '− punto', enabled: 'Activa',
    keystone: 'Corrección trapezoidal (keystone)', keystone_help: 'Arrastra las 4 esquinas en la vista previa para alinear la imagen completa con la pared.',
    reset: 'Restablecer', flip_x: 'Espejo horizontal (retroproyección)', flip_y: 'Invertir vertical (montaje en techo)',
    brightness: 'Brillo', contrast: 'Contraste', gamma: 'Gamma', saturation: 'Saturación', temperature: 'Temperatura de color', vignette: 'Viñeta',
    edge_blend: 'Fusión de bordes (multi-proyector)', left: 'Izquierda', right: 'Derecha', top: 'Arriba', bottom: 'Abajo',
    quality: 'Calidad de render', auto_quality: 'Calidad automática', show_fps: 'Mostrar FPS',
    test_pattern: 'Patrón de prueba', off: 'Apagado', grid: 'Grilla', white: 'Blanco',
    master: 'Brillo general', blackout: 'Apagón', identify: 'Identificar', fullscreen: 'Pantalla completa',
    audio_mode: 'Fuente de audio', audio_off: 'Sin audio', audio_bpm: 'Pulso automático (BPM)', audio_remote: 'Micrófono de este dispositivo', audio_mic: 'Micrófono de la pantalla',
    tap_tempo: 'Marcar tempo', bpm: 'BPM', mic_start: 'Activar micrófono', mic_stop: 'Detener micrófono', mic_https: 'El micrófono requiere HTTPS. Abre {url}',
    playlist_enable: 'Rotar escenas automáticamente', interval_min: 'Intervalo (minutos)', shuffle: 'Aleatorio', playlist_help: 'El servidor cambia de escena aunque cierres esta app.',
    rename_display: 'Nombre de la pantalla', forget: 'Olvidar', live_preview: 'Vista previa en vivo', calibrate_on_display: 'Mostrar guías en la pantalla',
    saved: 'Guardado', copied: 'Copiado', token_prompt: 'Este servidor requiere un token de acceso:', error: 'Error',
    nudge: 'Ajuste fino', selected_point: 'Punto seleccionado', share: 'Compartir', install: 'Instalar app',
    language: 'Idioma', layers: 'Capas', all: 'Todos', ambient: 'Ambiente', nature: 'Naturaleza', party: 'Fiesta', geometric: 'Geométricos', utility: 'Utilidades',
    connecting: 'Conectando…', fps: 'FPS',
    create: 'Crear', my_effects: 'Mis efectos', new_effect: 'Nuevo', template: 'Plantilla', effect_name: 'Nombre del efecto',
    target_surface: 'Probar en', live_to_display: 'En vivo en la pantalla', compiles: 'Compila correctamente',
    save_library: 'Guardar en mis efectos', export: 'Exportar', import: 'Importar', apply: 'Aplicar', edit: 'Editar',
    line: 'Línea', display_error: 'La pantalla no pudo compilar', editor_help: 'Referencia rápida',
    import_invalid: 'Archivo no válido', effect_saved: 'Efecto guardado',
    frame: 'Marco', frame_width: 'Grosor del marco', canvas_depth: 'Profundidad del lienzo', frame_color: 'Color del marco',
    mat_width: 'Paspartú (borde interior)', mat_color: 'Color del paspartú',
    frame_hint: 'El proyector solo suma luz: los marcos se ven más reales sobre paredes claras. Los tonos muy oscuros se ven como "sin luz".',
    art_style: 'Estilo artístico', art_amount: 'Intensidad del estilo', paint_in: 'Animación: se pinta sola',
    paint_seconds: 'Duración', paint_loop: 'Repetir', paint_replay: 'Volver a pintar',
    gallery: 'Galería (pase de fotos)', gallery_enable: 'Pasar varias fotos', gallery_photos: 'fotos',
    gallery_hint: 'Elige las fotos de tu biblioteca. El marco y el estilo se mantienen; todas las pantallas muestran la misma foto al mismo tiempo.',
    gallery_empty: 'Sube fotos con el botón de arriba para armar la galería.', gallery_seconds: 'Segundos por foto',
    gallery_transition: 'Duración de la transición', ken_burns: 'Zoom lento (Ken Burns)', gallery_restart: 'Empezar de nuevo',
    select_all: 'Todas', select_none: 'Ninguna',
  },
  en: {
    app_tagline: 'Projection mapping & ambient visuals',
    displays: 'Displays', no_displays: 'No displays connected yet.',
    no_displays_help: 'Open {url} on the projector, Google TV or any browser. You can also use this device:',
    open_here: 'Open display here', open_second: 'Second screen', cast: 'Cast',
    online: 'online', offline: 'offline', select_display: 'Choose a display',
    scenes: 'Scenes', surfaces: 'Surfaces', effect: 'Effect', masks: 'Zones', optics: 'Optics', audio: 'Audio', playlist: 'Schedule',
    presets: 'Built-in ambiences', my_scenes: 'My scenes', save_scene: 'Save current scene', scene_name: 'Scene name',
    apply_content: 'Apply (keep calibration)', apply_full: 'Replace everything', delete: 'Delete', rename: 'Rename',
    add_surface: 'Add surface', duplicate: 'Duplicate', reset_corners: 'Reset corners', full_frame: 'Full frame',
    visible: 'Visible', opacity: 'Opacity', feather: 'Soft edge', blend: 'Blend', blend_normal: 'Normal', blend_add: 'Additive',
    speed: 'Speed', intensity: 'Intensity', scale: 'Scale', hue: 'Hue', audio_react: 'Audio reactivity', palette: 'Palette',
    particles: 'Particles', count: 'Count', size: 'Size', trails: 'Trails',
    media: 'Image / video', upload: 'Upload file', fit: 'Fit', fit_cover: 'Cover', fit_contain: 'Contain', fit_stretch: 'Stretch',
    add_mask_rect: 'Rectangle zone', add_mask_circle: 'Circle zone', mask_exclude: 'Protect (no light)', mask_include: 'Only project here',
    masks_help: 'Protection zones block projector light: eyes, windows, screens, paintings… Drag the points in the preview.',
    add_point: '+ point', remove_point: '− point', enabled: 'Enabled',
    keystone: 'Keystone correction', keystone_help: 'Drag the 4 corners in the preview to align the whole image with the wall.',
    reset: 'Reset', flip_x: 'Mirror horizontally (rear projection)', flip_y: 'Flip vertically (ceiling mount)',
    brightness: 'Brightness', contrast: 'Contrast', gamma: 'Gamma', saturation: 'Saturation', temperature: 'Colour temperature', vignette: 'Vignette',
    edge_blend: 'Edge blending (multi-projector)', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom',
    quality: 'Render quality', auto_quality: 'Automatic quality', show_fps: 'Show FPS',
    test_pattern: 'Test pattern', off: 'Off', grid: 'Grid', white: 'White',
    master: 'Master brightness', blackout: 'Blackout', identify: 'Identify', fullscreen: 'Fullscreen',
    audio_mode: 'Audio source', audio_off: 'No audio', audio_bpm: 'Auto pulse (BPM)', audio_remote: 'This device\'s microphone', audio_mic: 'Display microphone',
    tap_tempo: 'Tap tempo', bpm: 'BPM', mic_start: 'Start microphone', mic_stop: 'Stop microphone', mic_https: 'Microphone requires HTTPS. Open {url}',
    playlist_enable: 'Rotate scenes automatically', interval_min: 'Interval (minutes)', shuffle: 'Shuffle', playlist_help: 'The server keeps switching scenes even if you close this app.',
    rename_display: 'Display name', forget: 'Forget', live_preview: 'Live preview', calibrate_on_display: 'Show guides on display',
    saved: 'Saved', copied: 'Copied', token_prompt: 'This server requires an access token:', error: 'Error',
    nudge: 'Fine adjust', selected_point: 'Selected point', share: 'Share', install: 'Install app',
    language: 'Language', layers: 'Layers', all: 'All', ambient: 'Ambient', nature: 'Nature', party: 'Party', geometric: 'Geometric', utility: 'Utilities',
    connecting: 'Connecting…', fps: 'FPS',
    create: 'Create', my_effects: 'My effects', new_effect: 'New', template: 'Template', effect_name: 'Effect name',
    target_surface: 'Preview on', live_to_display: 'Live on display', compiles: 'Compiles OK',
    save_library: 'Save to my effects', export: 'Export', import: 'Import', apply: 'Apply', edit: 'Edit',
    line: 'Line', display_error: 'The display could not compile', editor_help: 'Quick reference',
    import_invalid: 'Invalid file', effect_saved: 'Effect saved',
    frame: 'Frame', frame_width: 'Frame width', canvas_depth: 'Canvas depth', frame_color: 'Frame colour',
    mat_width: 'Mat (inner border)', mat_color: 'Mat colour',
    frame_hint: 'A projector only adds light: frames look most real on light walls. Very dark tones show as "no light".',
    art_style: 'Artistic style', art_amount: 'Style strength', paint_in: 'Animation: paints itself',
    paint_seconds: 'Duration', paint_loop: 'Repeat', paint_replay: 'Paint again',
    gallery: 'Gallery (slideshow)', gallery_enable: 'Show several photos', gallery_photos: 'photos',
    gallery_hint: 'Pick photos from your library. Frame and style stay; every display shows the same photo at the same time.',
    gallery_empty: 'Upload photos with the button above to build the gallery.', gallery_seconds: 'Seconds per photo',
    gallery_transition: 'Transition length', ken_burns: 'Slow zoom (Ken Burns)', gallery_restart: 'Start over',
    select_all: 'All', select_none: 'None',
  },
};

export let lang = localStorage.getItem('lp.lang') || ((navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en');

export function setLang(l) {
  lang = DICT[l] ? l : 'es';
  localStorage.setItem('lp.lang', lang);
  document.documentElement.lang = lang;
}

export function t(key, vars = {}) {
  let s = DICT[lang]?.[key] ?? DICT.es[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}
