<template>
  <div id="smartTimers" class="card mb-4" style="scroll-margin-top: 4rem;">
    <div>
      <button
        class="card-header d-flex justify-content-between align-items-center w-100 text-start"
        @click="isExpanded = !isExpanded"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? 'Collapse Smart Timers' : 'Expand Smart Timers'"
        type="button"
        style="cursor: pointer;"
      >
        <h2 class="mb-0">Smart Timers</h2>
        <i :class="isExpanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
      </button>
      
      <SmartTimerCreateForm
        v-if="showCreateForm"
        @create="handleTimerCreate"
        :require-auth="!sessionState.user"
        :tabindex="!sessionState.user ? 0 : -1"
        :class="{ ghosted: !sessionState.user }"
        :initial-data="duplicateTimerData"
      />
      <button
        class="btn btn-outline-primary my-2"
        v-if="!showCreateForm"
        @click="() => { duplicateTimerData = null; showCreateForm = true; }"
      >
        New Timer
      </button>

      <!-- FILTER DROPDOWN -->
      <div class="dropdown my-2" style="position: relative;">
        <button
          class="btn btn-outline-secondary dropdown-toggle"
          type="button"
          @click.stop="showFilterDropdown = !showFilterDropdown"
        >
          Filter Timers
        </button>
        <div
          v-if="showFilterDropdown"
          class="dropdown-menu show p-3"
          style="min-width: 200px; position: absolute; z-index: 100;"
          @click.stop
        >
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id="activeCheck"
              v-model="filters.active"
            />
            <label class="form-check-label" for="activeCheck">Active</label>
          </div>
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id="historicalCheck"
              v-model="filters.historical"
            />
            <label class="form-check-label" for="historicalCheck">Historical</label>
          </div>

          <hr>
          <div class="mb-2">
            <label for="keyword" class="form-label mb-0">Search by keyword:</label>
            <input id="keyword" v-model="filters.keyword" class="form-control" placeholder="Title or description" />
          </div>
          <div class="mb-2 d-flex align-items-center gap-2">
            <label class="form-label mb-0" style="width: 50%;">Min duration:</label>
            <input type="number" min="0" v-model.number="filters.minDuration" class="form-control" placeholder="min (min)" style="width: 50%;" />
          </div>
          <div class="mb-2 d-flex align-items-center gap-2">
            <label class="form-label mb-0" style="width: 50%;">Max duration:</label>
            <input type="number" min="0" v-model.number="filters.maxDuration" class="form-control" placeholder="max (min)" style="width: 50%;" />
          </div>
        </div>
      </div>

      <div v-show="isExpanded" class="card-body">
        <!-- Active Timers Group -->
        <div v-if="activeTimers.length">
          <h3 class="mb-4">Active Timers</h3>
          <div class="active-timers-container">
              <div class="row row-cols-1 row-cols-md-2 g-4">
                <div v-for="timer in activeTimers" :key="timer.id" class="col">
                  <SmartTimerCard
                    :timer="timer"
                    :smart-timers-api="smartTimersApi"
                    :users-api="usersApi"
                    :devices-api="devicesApi"
                    :is-historical="false"
                    @duplicate="handleDuplicateTimer"
                  />
                </div>
              </div>
          </div>
        </div>

        <!-- Historical Timers Group -->
        <div v-if="historicalTimers.length" class="mt-4">
          <h3 class="mb-4">Historical Timers</h3>
          <div class="historical-timers-container">
              <div class="row row-cols-1 row-cols-md-2 g-4">
                <div v-for="timer in historicalTimers" :key="timer.id" class="col">
                  <SmartTimerCard
                    :timer="timer"
                    :smart-timers-api="smartTimersApi"
                    :users-api="usersApi"
                    :devices-api="devicesApi"
                    :is-historical="true"
                    @duplicate="handleDuplicateTimer"
                  />
                </div>
              </div>
          </div>
        </div>

        <!-- If searching, but no matches -->
        <div v-if="!activeTimers.length && !historicalTimers.length" class="text-muted mt-3">
          No timers to display.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import SmartTimerCreateForm from './SmartTimerCreateForm.vue'
import SmartTimerCard from './SmartTimerCard.vue'

export default {
  name: 'SmartTimersSection',
  components: { SmartTimerCreateForm, SmartTimerCard },
  props: {
    smartTimersApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
    devicesApi: { type: Object, required: true },
    sessionState: { type: Object, required: true }
  },
  setup(props, { emit }) {
    const isExpanded = ref(true)
    const showFilterDropdown = ref(false)
    // Filter state
    const filters = ref({
      active: true,
      historical: false,
      keyword: '',
      minDuration: null,
      maxDuration: null
    })

    const allTimers = computed(() => Object.values(props.smartTimersApi.smartTimers))

    // Filtering logic (all in one place)
    const filteredTimers = computed(() => {
      let timers = allTimers.value

      // Active filter
      timers = timers.filter(t => {
        if (filters.value.active && filters.value.historical) return true; // show all
        if (filters.value.active) return !!t.active;
        if (filters.value.historical) return !t.active;
        return false; // none checked: show nothing
      });

      // Keyword filter
      const kw = filters.value.keyword.trim().toLowerCase()
      if (kw) {
        timers = timers.filter(t =>
            (t.label && t.label.toLowerCase().includes(kw))
        )
      }
      // Duration filter (assume timer.duration is seconds, convert to minutes)
      const getMinutes = t =>
          typeof t.duration === 'number'
          ? Math.floor(t.duration / 60)
          : (typeof t.initialDuration === 'number'
              ? Math.floor(t.initialDuration / 60)
              : 0)

      if (filters.value.minDuration != null && filters.value.minDuration !== '') {
          timers = timers.filter(t => getMinutes(t) >= filters.value.minDuration)
      }
      if (filters.value.maxDuration != null && filters.value.maxDuration !== '') {
          timers = timers.filter(t => getMinutes(t) <= filters.value.maxDuration)
      }
      return timers
    })

    // Grouped timers
    const activeTimers = computed(() =>
        // filteredTimers.value.filter(t => ACTIVE_STATES.includes(t.state))
        filteredTimers.value.filter(t => t.active)
    )

    const historicalTimers = computed(() =>
        // filteredTimers.value.filter(t => HISTORICAL_STATES.includes(t.state))
        filteredTimers.value.filter(t => !t.active)
    )



    // State for duplication
    const showCreateForm = ref(false)
    const duplicateTimerData = ref(null)

    // Show the timer create form with data from the duplicated timer
    function handleDuplicateTimer(timer) {
      duplicateTimerData.value = {
        label: timer.label || '',
        description: timer.description || '',
        minutes: timer.duration ? Math.floor(timer.duration / 60) : null,
        // You may use 'duration' directly if that's what the form expects
      }
      showCreateForm.value = true
    }

    // Standard timer creation handler, clears duplication state after use
    function handleTimerCreate(timerData) {
      emit('create', timerData)
      duplicateTimerData.value = null
      showCreateForm.value = false
    }

    // // Timer creation handler
    // function handleTimerCreate(timerData) {
    //   emit('create', timerData)
    // }

    // // Timer copy handler (if implemented in SmartTimerCard)
    // function handleCopyTimer(timer) {
    //   // You may want to prefill the SmartTimerCreateForm or create immediately
    //   // For now, emit up
    //   emit('copy-timer', timer)
    // }

    // Optional: close dropdown on click outside
    function handleClickOutside(event) {
      const dropdown = document.querySelector('.dropdown-menu.show')
      if (dropdown && !dropdown.contains(event.target)) {
        showFilterDropdown.value = false
      }
    }
    // Register click-outside listener
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleClickOutside)
    }

    return {
      isExpanded,
      showFilterDropdown,
      filters,
      activeTimers,
      historicalTimers,
      handleTimerCreate,
      handleDuplicateTimer,
      showCreateForm,
      duplicateTimerData
    }
  }
}
</script>
