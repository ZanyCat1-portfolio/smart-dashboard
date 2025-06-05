<template>
  <div
    class="custom-switch"
    :class="{ checked: modelValue, dark: isDark }"
    tabindex="0"
    @click="$emit('update:modelValue', !modelValue)"
    @keydown.space.prevent="$emit('update:modelValue', !modelValue)"
    :aria-checked="modelValue"
    role="switch"
  >
    <div class="track"></div>
    <div class="thumb"></div>
  </div>
</template>

<script>
export default {
  name: "AnimatedSwitch",
  props: {
    modelValue: { type: Boolean, required: true },
    isDark: { type: Boolean, default: false }
  }
};
</script>

<style scoped>
/* Bootstrap-like proportions: width 36px, height 16px, thumb 12px */
.custom-switch {
  width: 36px;
  height: 16px;
  border-radius: 8px;
  background: #c6c6c6;
  position: relative;
  cursor: pointer;
  transition: background 0.25s;
  display: inline-block;
  vertical-align: middle;
  outline: none;
  box-sizing: border-box;
}
.custom-switch.dark {
  background: #444;
}
.custom-switch .track {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: inherit;
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
}
.custom-switch .thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px; left: 2px;
  transition: left 0.25s, background 0.25s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.13);
}
.custom-switch.checked .thumb {
  left: 22px; /* 36-12-2px padding */
  background: #0d6efd; /* Bootstrap primary */
}
.custom-switch.dark.checked .thumb {
  background: #90caf9;
}
.custom-switch:focus {
  outline: 2px solid #0d6efd;
}
/* Optional: subtle border */
.custom-switch {
  border: 1px solid #c6c6c6;
}
.custom-switch.dark {
  border: 1px solid #333;
}
</style>
