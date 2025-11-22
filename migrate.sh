#!/bin/bash

# Create new directories
mkdir -p src/frontend src/backend
mkdir -p src/frontend/utils src/backend/utils

# Move frontend-specific items
mv src/components src/frontend/
mv src/composables src/frontend/
mv src/stores src/frontend/
mv src/assets src/frontend/
mv src/App.vue src/frontend/
mv src/main.js src/frontend/
mv src/style.css src/frontend/

# Move backend-specific items
mv src/api src/backend/
mv src/dal src/backend/
mv src/models src/backend/
mv src/middleware src/backend/
mv src/mqtt src/backend/
mv src/notifications src/backend/
mv src/data src/backend/

# Split utils - Frontend utilities
mv src/utils/eventBus.js src/frontend/utils/
mv src/utils/push.js src/frontend/utils/
mv src/utils/export.js src/frontend/utils/

# Split utils - Backend utilities
mv src/utils/smartTimer-logic.js src/backend/utils/
mv src/utils/smartTimer-mqtt.js src/backend/utils/
mv src/utils/apiHelpers.js src/backend/utils/
mv src/utils/logger.js src/backend/utils/

# Shared utility (could go either way - putting in backend for now)
mv src/utils/utils.js src/backend/utils/

# Clean up empty utils directory
rmdir src/utils

echo "Reorganization complete!"
echo ""
echo "Moved to src/frontend/utils:"
echo "  - eventBus.js (frontend event handling)"
echo "  - push.js (push notifications UI)"
echo "  - export.js (data export for user)"
echo ""
echo "Moved to src/backend/utils:"
echo "  - smartTimer-logic.js (timer business logic)"
echo "  - smartTimer-mqtt.js (MQTT handling)"
echo "  - apiHelpers.js (API utilities)"
echo "  - logger.js (logging)"
echo "  - utils.js (shared - review if needed on frontend)"
echo ""
echo "NEXT STEPS:"
echo "1. Update vite.config.js entry point to 'src/frontend/main.js'"
echo "2. Fix imports in your files (IDE should help)"
echo "3. Review utils.js - might need to duplicate if used on both sides"
