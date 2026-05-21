const { create } = require('zustand/vanilla');

const store = create((set, get) => ({
  mapStyle: 'dark',
  get isDarkMode() {
    return get().mapStyle !== 'light';
  },
  setMapStyle: (style) => set({ mapStyle: style }),
}));

console.log('initial:', store.getState().isDarkMode);
let lastVal = store.getState().isDarkMode;

store.subscribe((state) => {
  if (state.isDarkMode !== lastVal) {
    console.log('changed:', state.isDarkMode);
    lastVal = state.isDarkMode;
  }
});

store.getState().setMapStyle('light');
console.log('after set:', store.getState().isDarkMode);
