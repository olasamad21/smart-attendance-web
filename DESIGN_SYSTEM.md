# Kinetic Clarity Design System — Veriface Attendance App
## Reference for all Next.js components

---

## Tailwind Config (paste into tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#00535b',
        'on-primary': '#ffffff',
        'primary-container': '#006d77',
        'on-primary-container': '#9becf7',
        'primary-fixed': '#9ff0fb',
        'primary-fixed-dim': '#82d3de',
        'inverse-primary': '#82d3de',
        'secondary': '#236863',
        'on-secondary': '#ffffff',
        'secondary-container': '#a9ece5',
        'on-secondary-container': '#286d67',
        'secondary-fixed': '#acefe7',
        'secondary-fixed-dim': '#90d3cb',
        'tertiary': '#434c4f',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#5b6467',
        'on-tertiary-container': '#d8e1e4',
        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        'background': '#f9f9ff',
        'on-background': '#121c2c',
        'surface': '#f9f9ff',
        'on-surface': '#121c2c',
        'surface-dim': '#d0daf0',
        'surface-bright': '#f9f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f0f3ff',
        'surface-container': '#e7eeff',
        'surface-container-high': '#dee8ff',
        'surface-container-highest': '#d9e3f9',
        'on-surface-variant': '#3e494a',
        'surface-variant': '#d9e3f9',
        'surface-tint': '#006972',
        'inverse-surface': '#273141',
        'inverse-on-surface': '#ebf1ff',
        'outline': '#6f797a',
        'outline-variant': '#bec8ca',
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        'full': '9999px',
      },
      spacing: {
        'container-padding': '20px',
        'stack-gap': '16px',
        'element-gap': '12px',
        'section-margin': '32px',
        'touch-target': '48px',
      },
      fontSize: {
        'display': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', fontWeight: '500' }],
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0px 2px 8px rgba(0, 109, 119, 0.05)',
        'card-hover': '0px 4px 12px rgba(0, 109, 119, 0.12)',
        'bottom-nav': '0px -2px 8px rgba(0, 109, 119, 0.05)',
        'button': '0px 2px 8px rgba(0, 109, 119, 0.15)',
        'button-hover': '0px 4px 12px rgba(0, 109, 119, 0.25)',
      },
    },
  },
  plugins: [],
}
export default config
```

---

## globals.css additions

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

* {
  -webkit-font-smoothing: antialiased;
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.fill {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.card-shadow {
  box-shadow: 0px 2px 8px rgba(0, 109, 119, 0.05);
}
.card-interactive:active {
  transform: scale(0.98);
  box-shadow: inset 0 0 0 1px #006d77;
}

/* Hide scrollbar */
::-webkit-scrollbar { display: none; }
* { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## Key Design Patterns (copy these into every component)

### Page wrapper
```tsx
<div className="bg-background text-on-surface font-sans min-h-screen pb-24">
```

### Top App Bar
```tsx
<header className="bg-surface w-full sticky top-0 z-50 shadow-sm">
  <div className="flex items-center justify-between px-container-padding h-touch-target w-full">
    <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low text-primary active:scale-95">
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
    <h1 className="text-display font-bold text-primary tracking-tight">EduVerify</h1>
    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant overflow-hidden">
      <span className="material-symbols-outlined text-outline-variant" style={{fontSize: '20px'}}>person</span>
    </div>
  </div>
</header>
```

### Bottom Navigation Bar (Student)
```tsx
<nav className="bg-surface-container-lowest fixed bottom-0 w-full z-50 rounded-t-2xl border-t border-outline-variant shadow-bottom-nav">
  <div className="flex justify-around items-center h-16 w-full px-2">
    {/* Active tab */}
    <a href="/student/dashboard" className="flex flex-col items-center justify-center text-primary bg-secondary-container/30 rounded-full px-4 py-1 w-16">
      <span className="material-symbols-outlined fill">home</span>
      <span className="text-label-sm mt-1">Home</span>
    </a>
    {/* Inactive tab */}
    <a href="/student/courses" className="flex flex-col items-center justify-center text-on-surface-variant w-16">
      <span className="material-symbols-outlined">school</span>
      <span className="text-label-sm mt-1">Courses</span>
    </a>
  </div>
</nav>
```

### Bottom Navigation Bar (Lecturer)
Same pattern but tabs: Home, Courses, Attendance (fact_check), Profile

### White Card
```tsx
<div className="bg-surface-container-lowest rounded-[16px] p-4 card-shadow border border-outline-variant/20">
```

### Card with left accent bar (primary)
```tsx
<div className="bg-surface-container-lowest rounded-[16px] p-4 card-shadow border border-outline-variant/20 relative overflow-hidden">
  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
  {/* content */}
</div>
```

### Primary Action Button (full width)
```tsx
<button className="w-full h-touch-target bg-primary-container text-on-primary-container text-label-md font-semibold rounded-full shadow-button hover:shadow-button-hover hover:bg-primary-container/90 active:scale-95 transition-all flex items-center justify-center gap-2">
  Button Label
</button>
```

### Secondary/Ghost Button
```tsx
<button className="w-full h-touch-target bg-surface-container-high text-on-surface text-label-md font-semibold rounded-full border border-outline-variant/50 active:scale-95 transition-all flex items-center justify-center gap-2">
  Button Label
</button>
```

### Input Field
```tsx
<div className="flex flex-col gap-1">
  <label className="text-label-md text-on-surface-variant">Email</label>
  <div className="relative flex items-center">
    <span className="material-symbols-outlined absolute left-3 text-outline">mail</span>
    <input
      className="w-full h-12 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
      placeholder="student@university.edu"
      type="email"
    />
  </div>
</div>
```

### Status Chips
```tsx
{/* Present / Active */}
<span className="text-label-md text-secondary-container bg-secondary-container/10 px-3 py-1 rounded-full">Present</span>

{/* Live now */}
<span className="bg-primary-container/20 text-primary-container text-label-sm px-2 py-1 rounded-full border border-primary-container/30">Live now</span>

{/* Late */}
<span className="text-label-md text-error bg-error-container/30 px-3 py-1 rounded-full">Late</span>

{/* Upcoming */}
<span className="bg-surface-variant text-on-surface-variant text-label-sm px-2 py-1 rounded-full">Upcoming</span>
```

### Summary Stat Card (Bento style)
```tsx
<div className="bg-surface-container-lowest rounded-xl p-4 card-shadow flex flex-col justify-between border-l-4 border-primary">
  <span className="material-symbols-outlined text-outline mb-2">school</span>
  <div>
    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Courses Enrolled</p>
    <p className="text-headline-md text-on-surface">6</p>
  </div>
</div>
```

### List Row (with dividers)
```tsx
<div className="flex flex-col rounded-[16px] overflow-hidden border border-outline-variant/30 bg-surface-container-lowest card-shadow">
  <div className="flex items-center justify-between p-4 border-b border-surface-variant last:border-0 hover:bg-surface-container-low transition-colors cursor-pointer">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center">
        <span className="material-symbols-outlined text-secondary-container fill">check_circle</span>
      </div>
      <div>
        <h4 className="text-body-lg font-medium text-on-surface">MTH 301</h4>
        <p className="text-body-md text-on-surface-variant">Yesterday, 1:00 PM</p>
      </div>
    </div>
    <span className="material-symbols-outlined text-outline">chevron_right</span>
  </div>
</div>
```

### Active Session Hero Card (Lecturer Dashboard)
```tsx
<div className="col-span-2 bg-primary-container rounded-[16px] p-5 card-shadow flex flex-col justify-between relative overflow-hidden">
  <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
    <span className="material-symbols-outlined text-[120px]" style={{fontVariationSettings: "'FILL' 1"}}>radar</span>
  </div>
  <div className="flex items-start justify-between mb-4 relative z-10">
    <div>
      <span className="text-label-md text-on-primary-container opacity-80 uppercase tracking-wider">Active Session</span>
      <span className="text-headline-md text-on-primary mt-1 block">CSC 401</span>
    </div>
    <div className="bg-on-primary/20 px-3 py-1 rounded-full flex items-center gap-1 border border-on-primary/10">
      <div className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
      <span className="text-label-sm text-on-primary">Live</span>
    </div>
  </div>
</div>
```

### Camera Verification Screen
```tsx
{/* Full screen, camera behind */}
<div className="h-screen w-full overflow-hidden flex flex-col relative bg-black">
  <video className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
  
  {/* Overlay controls */}
  <div className="absolute inset-0 z-10 flex flex-col">
    {/* Header */}
    <div className="flex items-center p-4 justify-between">
      <button className="flex size-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h2 className="text-white text-lg font-bold drop-shadow-md">Verification Capture</h2>
      <div className="size-12" />
    </div>
    
    {/* GPS chip */}
    <div className="flex justify-end px-4">
      <div className="flex h-8 items-center gap-2 rounded-full bg-secondary-container/90 backdrop-blur-sm pl-2 pr-4 border border-secondary-fixed/50">
        <span className="material-symbols-outlined text-on-secondary-container fill" style={{fontSize: '20px'}}>check_circle</span>
        <p className="text-on-secondary-container text-sm font-medium">Location confirmed</p>
      </div>
    </div>
    
    {/* Face oval guide */}
    <div className="flex-1 flex items-center justify-center">
      <div className="relative w-64 h-80 rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
        {/* Scan line animation */}
      </div>
    </div>
    
    {/* Capture button */}
    <div className="flex justify-center pb-12">
      <button className="relative flex size-20 items-center justify-center rounded-full bg-white shadow-lg active:scale-95">
        <div className="absolute inset-2 rounded-full border-4 border-surface" />
        <span className="material-symbols-outlined text-tertiary fill" style={{fontSize: '32px'}}>photo_camera</span>
      </button>
    </div>
  </div>
</div>
```

### Live Session Monitor Timer Banner
```tsx
<div className="bg-primary-container rounded-xl p-6 text-on-primary shadow-card flex flex-col items-center relative overflow-hidden">
  <div className="absolute inset-0 opacity-10 bg-radial-gradient from-white" />
  <div className="text-label-md bg-white/20 px-3 py-1 rounded-full mb-3 uppercase tracking-widest z-10">Phase 1 Active</div>
  <div className="text-5xl font-bold tracking-tighter z-10 tabular-nums">14:32</div>
  <div className="text-body-md text-on-primary/80 mt-1 z-10">remaining</div>
</div>
```

---

## Icon Reference (Material Symbols Outlined)
Use these exact icon names — they're from the Google Material Symbols font:

| Purpose | Icon name |
|---------|-----------|
| Home | `home` |
| Courses | `school` |
| Attendance history | `fact_check` |
| Profile | `person` |
| Location | `location_on` |
| Clock/time | `schedule` |
| Camera | `photo_camera` |
| Face/verification | `verified_user` |
| Check | `check_circle` |
| Back arrow | `arrow_back` |
| Right chevron | `chevron_right` |
| Play/start | `play_arrow` |
| Radar (decorative) | `radar` |
| Lock | `lock` |
| Email | `mail` |
| Add/plus | `add` |
| Calendar | `calendar_today` |
| Groups/students | `groups` |
| Book/courses | `menu_book` |
| Edit | `edit` |
| Delete | `delete` |
| Report | `bar_chart` |

---

## Navigation Structure

### Student Bottom Nav (4 tabs)
1. Home → `/student/dashboard` icon: `home`
2. Courses → `/student/courses` icon: `school`
3. Attendance → `/student/history` icon: `fact_check`
4. Profile → `/student/profile` icon: `person`

### Lecturer Bottom Nav (4 tabs)
1. Home → `/lecturer/dashboard` icon: `home`
2. Courses → `/lecturer/courses` icon: `school`
3. Sessions → `/lecturer/sessions` icon: `fact_check`
4. Profile → `/lecturer/profile` icon: `person`

---

## Color Usage Rules

| Use case | Color token |
|----------|-------------|
| Primary actions, active nav | `primary` (#00535b) |
| Primary buttons background | `primary-container` (#006d77) |
| Primary button text | `on-primary-container` (#9becf7) |
| Page background | `background` (#f9f9ff) |
| White cards | `surface-container-lowest` (#ffffff) |
| Card background light | `surface-container-low` (#f0f3ff) |
| Input field background | `surface-container-lowest` |
| Body text | `on-surface` (#121c2c) |
| Secondary text | `on-surface-variant` (#3e494a) |
| Input borders | `outline-variant` (#bec8ca) |
| Active input border | `primary` |
| Error states | `error` (#ba1a1a) |
| Success/Present chip | `secondary-container` (#a9ece5) |
| Left accent bar active | `primary` |
| Left accent bar inactive | `outline-variant` |
