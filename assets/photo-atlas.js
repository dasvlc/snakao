/* Photo Atlas — static HTML/CSS/JS, designed for GitHub Pages.
 * Test ?demo=1 to explore with clearly labelled illustrative placeholders.
 * Real images are registered in data/photos.csv and stored in assets/photos/IMG_NNN.jpg.
 */
(() => {
  'use strict';
  const root = document.getElementById('photo-gallery');
  if (!root) return;

  const $ = id => document.getElementById(id);
  const isDemo = new URLSearchParams(location.search).get('demo') === '1' || location.pathname.endsWith('/preview.html');
  const gallery = root;
  const lightbox = $('collage-lightbox');
  const viewer = lightbox.querySelector('.collage-lightbox-image');
  const closeButton = lightbox.querySelector('.collage-close');
  const prevButton = lightbox.querySelector('.collage-prev');
  const nextButton = lightbox.querySelector('.collage-next');
  const categories = ['All', 'Volcanoes', 'Mountains', 'Water & Coast', 'Cities', 'Other Landscapes'];
  let mapHierarchy = {world:[]};
  let locationData = {regions:[]};
  function initLocations(data) {
    locationData = data;
    mapHierarchy = {world:[]};
    mapPositions = {world:{spots:{}}};
    for (const region of (data.regions || [])) {
      if (!region.id || !region.map) continue;
      mapHierarchy.world.push({id:region.id, next:region.map});
      mapPositions.world.spots[region.id] = region.world || {x:50,y:50};
      mapHierarchy[region.map] = [];
      mapPositions[region.map] = {spots:{}};
      translations.en[region.id] = region.id;
      translations.ja[region.id] = region.ja || region.id;
      for (const place of (region.places || [])) {
        mapHierarchy[region.map].push({id:place.id});
        mapPositions[region.map].spots[place.id] = place.point || {x:50,y:50};
        translations.en[place.id] = place.id;
        translations.ja[place.id] = place.ja || place.id;
      }
    }
  }
  const translations = {
    en: {All:'All', Volcanoes:'Volcanoes', Mountains:'Mountains', 'Water & Coast':'Water & Coast', Cities:'Cities', 'Other Landscapes':'Other Landscapes', World:'World', Japan:'Japan', Europe:'Europe', Oceania:'Oceania', Asama:'Asama', Hokkaido:'Hokkaido', Kyushu:'Kyushu', Italy:'Italy', Iceland:'Iceland', Alps:'Alps', 'New Zealand':'New Zealand', Australia:'Australia'},
    ja: {All:'すべて', Volcanoes:'火山', Mountains:'山', 'Water & Coast':'海岸', Cities:'街', 'Other Landscapes':'その他の風景', World:'世界', Japan:'日本', Europe:'ヨーロッパ', Oceania:'オセアニア', Asama:'浅間', Hokkaido:'北海道', Kyushu:'九州', Italy:'イタリア', Iceland:'アイスランド', Alps:'アルプス', 'New Zealand':'ニュージーランド', Australia:'オーストラリア'}
  };
  const text = (en, ja) => lang() === 'ja' ? ja : en;
  const lang = () => document.documentElement.dataset.language === 'ja' || document.documentElement.lang === 'ja' ? 'ja' : 'en';
  const tr = name => translations[lang()][name] || name;

  let photos = [];
  let displayed = [];
  let mapPositions = {};
  let mapLevel = 'world';
  let selectedPlace = null;
  let category = 'All';
  let currentIndex = 0;
  let lastFocused = null;
  let resizeScheduled = false;

  function parseCsv(csv) {
    // Supports quoted commas and escaped double quotes.
    const rows = []; let cell = '', row = [], quoted = false;
    csv = csv.replace(/^\uFEFF/, '');
    for (let i=0; i<csv.length; i++) {
      const c = csv[i];
      if (c === '"') {
        if (quoted && csv[i+1] === '"') {cell += '"'; i++;}
        else quoted = !quoted;
      } else if (c === ',' && !quoted) {row.push(cell); cell='';}
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && csv[i+1] === '\n') i++;
        row.push(cell); if (row.some(value => value.trim())) rows.push(row);
        row=[]; cell='';
      } else cell += c;
    }
    row.push(cell); if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }
  async function getCsv(url) {
    const r = await fetch(url);
    if (!r.ok) throw Error(`${url}: HTTP ${r.status}`);
    return parseCsv(await r.text());
  }
  const safeFilename = value => /^IMG_\d{3}\.jpg$/i.test(value);
  async function loadPhotos() {
    if (isDemo) {
      const response = await fetch('data/demo-photos.json');
      if (!response.ok) throw Error('Demo data unavailable');
      photos = await response.json();
    } else {
      // One CSV is the source of truth. Photos not listed here are not displayed.
      const rows = await getCsv('data/photos.csv');
      const headers = (rows.shift() || []).map(h=>h.trim().toLowerCase());
      photos = rows.map((cells, index) => {
        const o = Object.fromEntries(headers.map((h,i)=>[h,(cells[i]||'').trim()]));
        if (!safeFilename(o.filename || '')) {
          console.warn(`Skipping row ${index+2}: invalid filename`, o.filename);
          return null;
        }
        const lat=o.latitude === '' ? null : Number(o.latitude);
        const lng=o.longitude === '' ? null : Number(o.longitude);
        return {
          id:o.filename, src:`assets/photos/${o.filename}`,
          caption_en:o.caption_en || o.title_en || '', caption_ja:o.caption_ja || o.title_ja || '',
          region:o.region || '', place:o.place || '',
          lat:Number.isFinite(lat)?lat:null, lng:Number.isFinite(lng)?lng:null,
          category:o.category || '', camera:o.camera || '',
          featured:/^(1|true|yes)$/i.test(o.featured || ''),
          size:/^(1|true|yes)$/i.test(o.featured || '') ? 'large':'small'
        };
      }).filter(Boolean);
    }
    // Seeded stable ordering: reshuffling on filter changes would be distracting.
    photos.sort((a,b)=> hash(a.id) - hash(b.id));
  }
  function hash(str) { let n=2166136261; for(let i=0;i<str.length;i++) n=Math.imul(n^str.charCodeAt(i),16777619); return n>>>0; }
  function countFor(region,place) {return photos.filter(p=> (!region || p.region===region) && (!place || p.place===place)).length;}
  function createButton(label, fn, className, disabled=false) {
    const button=document.createElement('button');button.type='button';button.className=className;button.textContent=label;button.disabled=disabled;if(typeof fn==='function')button.addEventListener('click',fn);return button;
  }
  function setMap(level,place=null) {mapLevel=level;selectedPlace=place; renderMap();renderGallery();}
  function renderMap() {
    const image=$('atlas-map-image');
    image.src=`assets/maps/${mapLevel}.svg`;
    image.alt=`${mapLevel} map`;
    const breadcrumb=$('atlas-breadcrumb');breadcrumb.replaceChildren();
    breadcrumb.append(createButton(tr('World'),()=>setMap('world'),'',false));
    if(mapLevel!=='world') {
      const sep=document.createElement('span');sep.className='separator';sep.textContent='/';breadcrumb.append(sep);
      breadcrumb.append(createButton(tr(locationData.regions.find(r=>r.map===mapLevel)?.id || mapLevel),()=>setMap(mapLevel),'',false));
    }
    if(selectedPlace) {
      const sep=document.createElement('span');sep.className='separator';sep.textContent='/';breadcrumb.append(sep);
      breadcrumb.append(createButton(tr(selectedPlace),()=>{},'',true));
    }
    const marks=$('atlas-markers');marks.replaceChildren();
    for (const m of mapHierarchy[mapLevel] || []) {
      const coords=mapPositions[mapLevel]?.spots?.[m.id];if(!coords) continue;
      const region=mapLevel==='world'?m.id:(locationData.regions.find(r=>r.map===mapLevel)?.id || mapLevel);
      const count=countFor(region,mapLevel==='world'?null:m.id);
      const button=createButton(tr(m.id),'','atlas-marker');
      button.style.left=`${coords.x}%`; button.style.top=`${coords.y}%`;
      button.setAttribute('aria-label',`${tr(m.id)}, ${count} photos`);
      const number=document.createElement('span'); number.className='atlas-marker-count';number.textContent=count;button.append(number);
      button.addEventListener('click',()=>{if(m.next) setMap(m.next);else setMap(mapLevel,selectedPlace===m.id?null:m.id);});
      if(selectedPlace===m.id) button.setAttribute('aria-pressed','true');
      marks.append(button);
    }
  }
  function renderCategories() {
    const group=$('atlas-categories');group.replaceChildren();
    for(const key of categories) {
      const button=createButton('',()=>{category=key;renderCategories();renderGallery();},'atlas-category');
      const span=document.createElement('span');span.textContent=tr(key);button.append(span);
      button.setAttribute('aria-pressed',String(key===category));group.append(button);
    }
  }
  function filterPhotos() {
    const region=mapLevel==='world'?'':(locationData.regions.find(r=>r.map===mapLevel)?.id || mapLevel);
    return photos.filter(p=> (!region||p.region===region) && (!selectedPlace||p.place===selectedPlace) && (category==='All'||p.category===category));
  }
  function resizeGallery() {
    const styles=getComputedStyle(gallery),row=parseFloat(styles.gridAutoRows),gap=parseFloat(styles.rowGap)||0;
    if(!Number.isFinite(row)||row<=0) return;
    gallery.querySelectorAll('.collage-item').forEach(item=>{
      const img=item.querySelector('img');if(!img?.naturalWidth)return;
      const height=img.getBoundingClientRect().height;
      item.style.gridRowEnd=`span ${Math.max(1,Math.ceil((height+gap)/(row+gap)))}`;
    });
  }
  function scheduleResize() {if(resizeScheduled)return;resizeScheduled=true;requestAnimationFrame(()=>{resizeScheduled=false;resizeGallery();});}
  function renderGallery() {
    displayed=filterPhotos();gallery.replaceChildren();
    $('atlas-count').textContent=`(${displayed.length})`;
    const empty=$('atlas-empty');empty.hidden=displayed.length!==0;
    empty.textContent=text('No photographs are tagged with this location yet. Choose another location or Show all photographs.','この地域に登録された写真はまだありません。別の地域か「すべての写真」を選んでください。');
    displayed.forEach((photo,index)=>{
      const link=document.createElement('a');link.className=`collage-item ${photo.featured || photo.size==='large'?'large':''}`;
      link.href=photo.src;link.setAttribute('aria-label',`Open photo ${index+1}`);
      const img=document.createElement('img');img.src=photo.src;img.alt=photo.alt||'';img.decoding='async';img.loading='lazy';
      img.addEventListener('load',scheduleResize);
      img.addEventListener('error',()=>{link.remove();scheduleResize();});
      link.append(img);gallery.append(link);
      link.addEventListener('click',e=>{e.preventDefault();if(img.naturalWidth) openLightbox(index,link);});
    });
    scheduleResize();
  }
  function distanceKm(a,b) {
    if (![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite)) return Infinity;
    const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lng-a.lng)*rad;
    const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  function relatedPhotos(photo) {
    return photos.filter(other=>other.id!==photo.id).map(other=>({other,km:distanceKm(photo,other)})).filter(x=>Number.isFinite(x.km)).sort((a,b)=>a.km-b.km).slice(0,2);
  }
  function showPhoto() {
    const p=displayed[currentIndex];if(!p)return;
    viewer.src=p.src;
    const cap=p[`caption_${lang()}`]||p.caption_en||p[`title_${lang()}`]||p.title_en||p.title||'';
    viewer.alt=cap;
    $('collage-caption').textContent=cap;
    $('atlas-photo-location').textContent=[p.region,p.place].filter(Boolean).map(tr).join(' / ');
    $('atlas-photo-coordinates').textContent=Number.isFinite(p.lat)&&Number.isFinite(p.lng)?`${p.lat.toFixed(3)}°, ${p.lng.toFixed(3)}°`:'';
    $('atlas-photo-camera').textContent=p.camera||'';
    lightbox.querySelector('.collage-counter').textContent=`${currentIndex+1} / ${displayed.length}`;
    const related=$('atlas-related');related.replaceChildren();
    const found=relatedPhotos(p);if(!found.length)return;
    const h=document.createElement('h3');h.textContent=text('Nearby photographs','近くで撮影された写真');related.append(h);
    const list=document.createElement('div');list.className='atlas-related-list';
    for(const {other,km} of found) {
      const b=createButton('',()=>{
        const index=displayed.findIndex(x=>x.id===other.id);
        if(index!==-1) {currentIndex=index;showPhoto();}
        else { // Nearby photographs can be outside current filters.
          setMap('world');category='All';renderCategories();renderGallery();
          currentIndex=displayed.findIndex(x=>x.id===other.id);showPhoto();
        }
      },'atlas-related-item');
      const img=document.createElement('img');img.src=other.src;img.alt='';img.loading='lazy';
      const distance=document.createElement('span');distance.textContent=`${Math.round(km).toLocaleString()} km away`;
      b.append(img,distance);list.append(b);
    }
    related.append(list);
  }
  function openLightbox(index,element) {currentIndex=index;lastFocused=element;lightbox.hidden=false;document.body.classList.add('lightbox-open');showPhoto();closeButton.focus();}
  function closeLightbox(){lightbox.hidden=true;viewer.removeAttribute('src');document.body.classList.remove('lightbox-open');lastFocused?.isConnected&&lastFocused.focus();}
  function movePhoto(by){if(!displayed.length)return;currentIndex=(currentIndex+by+displayed.length)%displayed.length;showPhoto();}
  function updateLanguage(){renderMap();renderCategories();if(!lightbox.hidden)showPhoto();}
  document.addEventListener('keydown',e=>{
    if(lightbox.hidden)return;
    if(e.key==='Escape')closeLightbox();
    else if(e.key==='ArrowLeft')movePhoto(-1);
    else if(e.key==='ArrowRight')movePhoto(1);
    else if(e.key==='Tab'){
      const focusable=Array.from(lightbox.querySelectorAll('button:not([disabled])')).filter(b=>b.offsetParent!==null);
      if(!focusable.length)return;
      const i=focusable.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();focusable.at(-1).focus();}
      else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();focusable[0].focus();}
    }
  });
  closeButton.addEventListener('click',closeLightbox);
  prevButton.addEventListener('click',()=>movePhoto(-1));
  nextButton.addEventListener('click',()=>movePhoto(1));
  lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
  $('atlas-reset').addEventListener('click',()=>{category='All';setMap('world');renderCategories();});
  window.addEventListener('resize',scheduleResize);
  // Existing assets/lang.js may update either data-language or lang.
  const langObserver=new MutationObserver(updateLanguage);
  langObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-language','lang']});
  document.querySelectorAll('[data-setlang]').forEach(b=>b.addEventListener('click',()=>setTimeout(updateLanguage,0)));

  Promise.all([loadPhotos(),fetch('data/locations.json').then(r=>{if(!r.ok)throw Error('Locations data missing');return r.json();})])
    .then(([,locations])=>{initLocations(locations);renderCategories();renderMap();renderGallery();})
    .catch(err=>{console.error('Photo Atlas could not initialize:',err);$('atlas-empty').hidden=false;$('atlas-empty').textContent='Could not load map data. Please use a local server or GitHub Pages (not file://).';});
})();
