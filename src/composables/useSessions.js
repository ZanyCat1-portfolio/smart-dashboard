import { reactive, readonly } from 'vue'

export const state = reactive({
    user: null
})

export function useSession() {
    async function fetchSession() {
        // console.log("are we fetch session yet?")
        const res = await fetch('/api/auth/session')
        // console.log("what is useSession res:", res)
        if (res.ok) {
            const json = await res.json()
            state.user = json.user || null
        } else {
            state.user = null
        }
    }

    // this gets called by logging in via UI
    async function login(username, password) {
        // console.log("IS THIS LOGIN GETTING CALLED")
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        if (res.ok) {
            const json = await res.json()
            return json.user
            // state.user = json.user
            // localStorage.setItem('user', JSON.stringify(state.user));
            // console.log("what is state.user:", state.user)
            // return state.user // <--- return user object!
        }
        return null
    }

    // this gets called by logging out via UI
    async function logout() {
        // console.log("IS THIS LOGOUT GETTING CALLED")
        await fetch('/api/auth/logout', { method: 'POST' })
        localStorage.setItem('user', '');
        console.log("localStorage: ", localStorage)
        state.user = null
    }

    async function register(username, password) {
        // console.log("username/password:", username, password)
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        console.log('res is: ', res)
        if (res.ok) {
            // Fetch session or parse user from response as needed
            return true
        }
        return false
    }

    return {
        state,
        fetchSession,
        login,
        logout,
        register
    }
}
