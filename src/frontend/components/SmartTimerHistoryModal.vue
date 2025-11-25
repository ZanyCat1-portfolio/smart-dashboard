<template>
  <div v-if="show" class="modal-overlay" @click="close" tabindex="-1">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>Timer History: "{{ selectedLabel }}"</h2>
        <button @click="close" class="btn-close" aria-label="Close"></button>
      </div>

      <div class="modal-body">
        <!-- FILTERS -->
        <div class="filters-section mb-3">
          <div class="row g-2">
            <div class="col-md-3">
              <label class="form-label mb-0">Min duration:</label>
              <input type="number" min="0" v-model.number="filters.minDuration" class="form-control" placeholder="min (min)" />
            </div>
            <div class="col-md-3">
              <label class="form-label mb-0">Max duration:</label>
              <input type="number" min="0" v-model.number="filters.maxDuration" class="form-control" placeholder="max (min)" />
            </div>
            <div class="col-md-3">
              <label class="form-label mb-0">Start date:</label>
              <input
                type="date"
                v-model="filters.startDate"
                class="form-control"
              />
            </div>
            <div class="col-md-3">
              <label class="form-label mb-0">End date:</label>
              <input
                type="date"
                v-model="filters.endDate"
                class="form-control"
              />
            </div>
          </div>
        </div>

        <!-- STATS -->
        <div class="stats-section mb-3" v-if="filteredHistoryList.length > 0">
          <small class="text-muted">
            Showing {{ currentPageStart }}-{{ currentPageEnd }} of {{ totalCount }} timers
          </small>
        </div>

        <!-- EMPTY STATE -->
        <div v-if="!filteredHistoryList.length" class="text-center text-muted py-4">
          No timers found matching the filters.
        </div>

        <!-- CAROUSEL -->
        <div v-else class="carousel-container">
          <button
            @click="previousPage"
            :disabled="currentPage === 0"
            class="carousel-nav carousel-prev"
            aria-label="Previous"
          >
            <i class="bi bi-chevron-left"></i>
          </button>

          <div class="carousel-cards">
            <div class="row row-cols-1 row-cols-md-2 g-3">
              <div
                v-for="(timer, index) in paginatedTimers"
                :key="timer.id"
                class="col"
              >
                <SmartTimerHistoryItem
                  :timer="timer"
                  :smart-timers-api="smartTimersApi"
                  :users-api="usersApi"
                  :devices-api="devicesApi"
                  @duplicate="$emit('duplicate-timer', timer)"
                />
              </div>
            </div>
          </div>

          <button
            @click="nextPage"
            :disabled="!hasNextPage"
            class="carousel-nav carousel-next"
            aria-label="Next"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import SmartTimerHistoryItem from './SmartTimerHistoryItem.vue'

export default {
  name: 'SmartTimerHistoryModal',
  components: { SmartTimerHistoryItem },
  props: {
    show: { type: Boolean, default: false },
    selectedLabel: { type: String, default: '' },
    smartTimersApi: { type: Object, required: true },
    usersApi: { type: Object, required: true },
    devicesApi: { type: Object, required: true },
    allTimers: { type: Array, default: () => [] }
  },
  emits: ['close', 'duplicate-timer'],
  setup(props, { emit }) {
    const currentPage = ref(0)
    const pageSize = ref(20) // Show 20 timers per page

    const filters = ref({
      minDuration: null,
      maxDuration: null,
      startDate: null,
      endDate: null
    })

    // Get all historical timers with the selected label (case-insensitive)
    const historyList = computed(() => {
      const normalizedLabel = props.selectedLabel.toLowerCase().trim()
      return props.allTimers.filter(timer =>
        !timer.active &&
        (timer.state === 'finished' || timer.state === 'canceled') &&
        timer.label &&
        timer.label.toLowerCase().trim() === normalizedLabel
      ).sort((a, b) =>
        new Date(b.endTime || b.end_time || b.updatedAt) -
        new Date(a.endTime || a.end_time || a.updatedAt)
      )
    })

    // Apply filters to history list
    const filteredHistoryList = computed(() => {
      let timers = [...historyList.value]

      // Duration filter (initial duration in minutes)
      const getInitialMinutes = t => Math.floor(t.initialDuration / 60) || 0

      if (filters.value.minDuration != null && filters.value.minDuration !== '') {
        timers = timers.filter(t => getInitialMinutes(t) >= filters.value.minDuration)
      }
      if (filters.value.maxDuration != null && filters.value.maxDuration !== '') {
        timers = timers.filter(t => getInitialMinutes(t) <= filters.value.maxDuration)
      }

      // Date filter (end_time)
      const start = filters.value.startDate ? new Date(filters.value.startDate) : null
      const end = filters.value.endDate ? new Date(filters.value.endDate) : null

      if (start || end) {
        timers = timers.filter(t => {
          const endTime = new Date(t.endTime || t.end_time || t.updatedAt)
          if (start && endTime < start) return false
          if (end && endTime > new Date(end.getTime() + 24 * 60 * 60 * 1000)) return false // Include end date
          return true
        })
      }

      return timers.sort((a, b) =>
        new Date(b.endTime || b.end_time || b.updatedAt) -
        new Date(a.endTime || a.end_time || a.updatedAt)
      )
    })

    // Pagination
    const totalCount = computed(() => filteredHistoryList.value.length)
    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))
    const hasNextPage = computed(() => currentPage.value < totalPages.value - 1)
    const hasPreviousPage = computed(() => currentPage.value > 0)

    const paginatedTimers = computed(() => {
      const start = currentPage.value * pageSize.value
      const end = start + pageSize.value
      return filteredHistoryList.value.slice(start, end)
    })

    const currentPageStart = computed(() =>
      paginatedTimers.value.length > 0
        ? currentPage.value * pageSize.value + 1
        : 0
    )

    const currentPageEnd = computed(() =>
      currentPage.value * pageSize.value + paginatedTimers.value.length
    )

    // Watch for filters change and reset page
    watch(filters.value, () => {
      currentPage.value = 0
    })

    // Watch for selectedLabel change and reset
    watch(() => props.selectedLabel, () => {
      currentPage.value = 0
      // Reset filters
      filters.value = {
        minDuration: null,
        maxDuration: null,
        startDate: null,
        endDate: null
      }
    })

    function nextPage() {
      if (hasNextPage.value) {
        currentPage.value++
      }
    }

    function previousPage() {
      if (hasPreviousPage.value) {
        currentPage.value--
      }
    }

    function close() {
      currentPage.value = 0
      emit('close')
    }

    return {
      filters,
      currentPage,
      pageSize,
      historyList,
      filteredHistoryList,
      totalCount,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      paginatedTimers,
      currentPageStart,
      currentPageEnd,
      nextPage,
      previousPage,
      close
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 0;
  z-index: 1050;
  overflow-y: auto;
}

.modal-container {
  background: white;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border-radius: 0.5rem 0.5rem 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #495057;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6c757d;
  cursor: pointer;
  padding: 0.25rem;
}

.btn-close:hover {
  color: #343a40;
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.filters-section {
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  padding: 1rem;
  background: #f8f9fa;
}

.stats-section {
  text-align: center;
  padding: 0.5rem 0;
}

.carousel-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.carousel-nav {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.carousel-nav:hover:not(:disabled) {
  background: #0056b3;
  transform: scale(1.1);
}

.carousel-nav:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.carousel-nav i {
  font-size: 1.25rem;
}

.carousel-cards {
  flex: 1;
  min-width: 0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .modal-container {
    background: #343a40;
    color: #ffffff;
  }

  .modal-header {
    background: #495057;
    border-color: #6c757d;
  }

  .modal-header h2 {
    color: #ffffff;
  }

  .filters-section {
    border-color: #6c757d;
    background: #495057;
  }

  .btn-close {
    color: #adb5bd;
  }

  .btn-close:hover {
    color: #ffffff;
  }
}
</style scoped>
