import { reactive, readonly } from 'vue'

const state = reactive({
    user: null
})

export function useSession() {
    async function fetchSession() {
        console.log("are we fetch session yet?")
        const res = await fetch('/api/auth/session')
        console.log("what is useSession res:", res)
        if (res.ok) {
            const json = await res.json()
            state.user = json.user || null
        } else {
            state.user = null
        }
    }

    async function login(username, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        if (res.ok) {
            const json = await res.json()
            state.user = json.user
            return state.user // <--- return user object!
        }
        return null
    }

    async function logout() {
        await fetch('/api/auth/logout', { method: 'POST' })
        state.user = null
    }

    async function register(username, password) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        console.log('res is: ', res)
        if (res.ok) {
            // Fetch session or parse user from response as needed
            await fetchSession()
            return state.user // <--- return user object!
        }
        return null
    }

    return {
        user: readonly(state.user),
        fetchSession,
        login,
        logout,
        register
    }
}
