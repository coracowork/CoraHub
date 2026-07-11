#!/usr/bin/env bun
/**
 * ACP Client — minimal CLI for the Agent Client Protocol.
 *
 * Spawns any ACP-compatible Agent as a child process and communicates
 * via JSON-RPC over stdio. Implements all Client-side capabilities
 * (fs, terminal, permissions) so agents can use them during prompts.
 *
 * ── CLI ────────────────────────────────────────────────────────
 *
 *   client.ts <agent-command> [agent-args...] initialize [options]
 *   client.ts <agent-command> [agent-args...] prompt <text> [options]
 *
 *   Options:
 *     --cwd <path>       Working directory (default: cwd)
 *     --timeout <ms>     Timeout in ms (default: 300000)
 *     --verbose          Print raw JSON-RPC to stderr
 *
 *   Examples:
 *     client.ts codex-acp initialize
 *     client.ts codex-acp prompt "Fix the type error in src/main.ts"
 *     client.ts bun ./agent.js initialize --verbose
 *     client.ts codex-acp prompt "Explain this" --cwd ~/project
 *
 * ── Module usage ───────────────────────────────────────────────
 *
 *   import { AcpClient } from './client';
 *   const c = new AcpClient({ command: 'codex-acp' });
 *   c.start();
 *   const init = await c.initialize();
 *   const s = await c.sessionNew('/tmp');
 *   const r = await c.sessionPrompt(s.sessionId, 'Hello');
 *   c.close();
 *
 * @see https://agentclientprotocol.com/protocol/overview
 */

import { ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createInterface, Interface as ReadlineInterface } from 'readline'

const JSONRPC_VERSION = '2.0'
const PROTOCOL_VERSION = 1

// ── Types ──────────────────────────────────────────────────────

interface ClientCapabilities {
    fs?: { readTextFile?: boolean; writeTextFile?: boolean }
    terminal?: boolean
}

interface ClientInfo {
    name: string
    title: string
    version: string
}

interface AcpClientOptions {
    command: string
    args?: string[]
    cwd?: string
    capabilities?: ClientCapabilities
    clientInfo?: ClientInfo
    autoApprovePermissions?: boolean
    onUpdate?: (sessionId: string, update: any) => void
    onPermissionRequest?: (params: any) => Promise<string>
    verbose?: boolean
}

interface PendingRequest {
    resolve: (value: any) => void
    reject: (reason: any) => void
}

interface Terminal {
    proc: ChildProcess
    output: string
    truncated: boolean
    exitStatus: { exitCode: number | null; signal: string | null } | null
    outputByteLimit: number | null
    waiters: Array<(status: { exitCode: number | null; signal: string | null }) => void>
}

interface Notification {
    method: string
    params: any
    _meta?: any
}

interface HandledRequest {
    method: string
    params: any
}

interface JsonRpcMessage {
    jsonrpc?: string
    id?: number
    method?: string
    params?: any
    result?: any
    error?: { code: number; message: string }
    _meta?: any
}

// ════════════════════════════════════════════════════════════════
// AcpClient — reusable Client implementation
// ════════════════════════════════════════════════════════════════

class AcpClient {
    private _command: string
    private _args: string[]
    private _cwd: string
    private _verbose: boolean
    private _autoApprove: boolean
    private _onUpdate: ((sessionId: string, update: any) => void) | null
    private _onPermissionRequest: ((params: any) => Promise<string>) | null

    private _clientCapabilities: ClientCapabilities
    private _clientInfo: ClientInfo

    private _requestId: number
    private _pending: Map<number, PendingRequest>
    private _child: ChildProcess | null
    private _rl: ReadlineInterface | null

    private _terminalCounter: number
    private _terminals: Map<string, Terminal>

    private _notifications: Notification[]
    private _handledRequests: HandledRequest[]
    private _agentCapabilities: any
    private _agentInfo: any

    handlers: Record<string, (params: any) => any> = {
        'session/request_permission': (p) => this._handleRequestPermission(p),
        'fs/read_text_file': (p) => this._handleFsRead(p),
        'fs/write_text_file': (p) => this._handleFsWrite(p),
        'terminal/create': (p) => this._handleTerminalCreate(p),
        'terminal/output': (p) => this._handleTerminalOutput(p),
        'terminal/wait_for_exit': (p) => this._handleTerminalWaitForExit(p),
        'terminal/kill': (p) => this._handleTerminalKill(p),
        'terminal/release': (p) => this._handleTerminalRelease(p),
    }

    constructor(opts: AcpClientOptions) {
        this._command = opts.command
        this._args = opts.args || []
        this._cwd = opts.cwd || process.cwd()
        this._verbose = opts.verbose || false
        this._autoApprove = opts.autoApprovePermissions !== false
        this._onUpdate = opts.onUpdate || null
        this._onPermissionRequest = opts.onPermissionRequest || null

        this._clientCapabilities = opts.capabilities || {
            fs: { readTextFile: true, writeTextFile: true },
            terminal: true,
        }
        this._clientInfo = opts.clientInfo || {
            name: 'acp-client',
            title: 'ACP Client',
            version: '1.0.0',
        }

        this._requestId = 0
        this._pending = new Map()
        this._child = null
        this._rl = null

        this._terminalCounter = 0
        this._terminals = new Map()

        this._notifications = []
        this._handledRequests = []
        this._agentCapabilities = null
        this._agentInfo = null
    }

    // ── Lifecycle ──────────────────────────────────────────────

    start(): void {
        this._child = spawn(this._command, this._args, {
            stdio: ['pipe', 'pipe', 'inherit'],
            cwd: this._cwd,
        })

        this._rl = createInterface({ input: this._child.stdout!, terminal: false })
        this._rl.on('line', (line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return
            try {
                const msg: JsonRpcMessage = JSON.parse(trimmed)
                if (this._verbose) process.stderr.write(`<- ${trimmed}\n`)
                this._handleMessage(msg)
            } catch {
                /* ignore */
            }
        })

        this._child.on('exit', (code: number | null) => {
            for (const [, { reject }] of this._pending) {
                reject(new Error(`Agent exited with code ${code}`))
            }
            this._pending.clear()
        })
    }

    close(): void {
        for (const [, term] of this._terminals) {
            if (term.proc && !term.exitStatus) {
                try {
                    term.proc.kill('SIGTERM')
                } catch {
                    /* */
                }
            }
        }
        this._terminals.clear()
        if (this._child) {
            this._child.stdin!.end()
            this._child = null
        }
    }

    // ── Message routing ────────────────────────────────────────

    private _handleMessage(msg: JsonRpcMessage): void {
        if (msg.id !== undefined && !msg.method) {
            const h = this._pending.get(msg.id)
            if (h) {
                this._pending.delete(msg.id)
                msg.error ? h.reject(new Error(`[${msg.error.code}] ${msg.error.message}`)) : h.resolve(msg.result)
            }
            return
        }
        if (msg.id === undefined && msg.method) {
            this._handleNotification(msg.method, msg.params, msg._meta)
            return
        }
        if (msg.id !== undefined && msg.method) {
            this._handleIncomingRequest(msg.id, msg.method, msg.params)
        }
    }

    private _handleNotification(method: string, params: any, meta: any): void {
        this._notifications.push({ method, params, _meta: meta })
        if (method === 'session/update' && this._onUpdate) this._onUpdate(params?.sessionId, params?.update)
    }

    private async _handleIncomingRequest(id: number, method: string, params: any): Promise<void> {
        this._handledRequests.push({ method, params })
        try {
            const handler = this.handlers[method]
            if (!handler) {
                this._sendRaw({
                    jsonrpc: JSONRPC_VERSION,
                    id,
                    error: { code: -32601, message: `Method not found: ${method}` },
                })
                return
            }
            const result = await handler(params)
            this._sendRaw({ jsonrpc: JSONRPC_VERSION, id, result: result ?? {} })
        } catch (err: any) {
            this._sendRaw({ jsonrpc: JSONRPC_VERSION, id, error: { code: -32000, message: err.message } })
        }
    }

    // ── Client handlers (Agent -> Client) ──────────────────────

    private async _handleRequestPermission(params: any): Promise<any> {
        if (this._onPermissionRequest) return { outcome: await this._onPermissionRequest(params) }
        if (this._autoApprove) {
            const opt = params?.options?.find((o: any) => o.kind === 'allow_once' || o.kind === 'allow_always')
            if (opt) return { outcome: { outcome: 'selected', optionId: opt.optionId } }
        }
        const rej = params?.options?.find((o: any) => o.kind === 'reject_once' || o.kind === 'reject_always')
        return { outcome: rej ? { outcome: 'selected', optionId: rej.optionId } : { outcome: 'cancelled' } }
    }

    private async _handleFsRead(params: any): Promise<any> {
        if (!params?.path) throw new Error('path is required')
        const content = await fs.promises.readFile(params.path, 'utf-8')
        if (params.line || params.limit) {
            const lines = content.split('\n')
            const start = (params.line || 1) - 1
            return { content: lines.slice(start, start + (params.limit || lines.length)).join('\n') }
        }
        return { content }
    }

    private async _handleFsWrite(params: any): Promise<any> {
        if (!params?.path) throw new Error('path is required')
        if (params.content === undefined) throw new Error('content is required')
        await fs.promises.mkdir(path.dirname(params.path), { recursive: true })
        await fs.promises.writeFile(params.path, params.content, 'utf-8')
        return {}
    }

    private async _handleTerminalCreate(params: any): Promise<any> {
        if (!params?.command) throw new Error('command is required')
        const terminalId = `term_${++this._terminalCounter}`
        const env: Record<string, string> = { ...(process.env as Record<string, string>) }
        for (const { name, value } of params.env || []) env[name] = value
        const proc = spawn(params.command, params.args || [], {
            cwd: params.cwd || this._cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        const terminal: Terminal = {
            proc,
            output: '',
            truncated: false,
            exitStatus: null,
            outputByteLimit: params.outputByteLimit ?? null,
            waiters: [],
        }
        const append = (d: Buffer) => {
            terminal.output += d.toString()
            if (
                terminal.outputByteLimit !== null &&
                Buffer.byteLength(terminal.output, 'utf-8') > terminal.outputByteLimit
            ) {
                const buf = Buffer.from(terminal.output, 'utf-8')
                terminal.output = buf.slice(buf.length - terminal.outputByteLimit).toString('utf-8')
                terminal.truncated = true
            }
        }
        proc.stdout!.on('data', append)
        proc.stderr!.on('data', append)
        proc.on('exit', (code: number | null, sig: string | null) => {
            terminal.exitStatus = { exitCode: code, signal: sig || null }
            terminal.waiters.forEach((w) => w(terminal.exitStatus!))
            terminal.waiters = []
        })
        this._terminals.set(terminalId, terminal)
        return { terminalId }
    }

    private _handleTerminalOutput(params: any): any {
        const t = this._getTerm(params?.terminalId)
        return { output: t.output, truncated: t.truncated, exitStatus: t.exitStatus }
    }

    private _handleTerminalWaitForExit(params: any): any {
        const t = this._getTerm(params?.terminalId)
        if (t.exitStatus) return { exitCode: t.exitStatus.exitCode, signal: t.exitStatus.signal }
        return new Promise((resolve) => {
            t.waiters.push((s) => resolve({ exitCode: s.exitCode, signal: s.signal }))
        })
    }

    private _handleTerminalKill(params: any): any {
        const t = this._getTerm(params?.terminalId)
        if (!t.exitStatus && t.proc) t.proc.kill('SIGTERM')
        return {}
    }

    private _handleTerminalRelease(params: any): any {
        const id = params?.terminalId
        const t = this._getTerm(id)
        if (!t.exitStatus && t.proc) t.proc.kill('SIGTERM')
        this._terminals.delete(id)
        return {}
    }

    private _getTerm(id: string): Terminal {
        const t = this._terminals.get(id)
        if (!t) throw new Error(`Unknown terminal: ${id}`)
        return t
    }

    // ── Outgoing (Client -> Agent) ─────────────────────────────

    _sendRaw(obj: any): void {
        const s = JSON.stringify(obj)
        if (this._verbose) process.stderr.write(`-> ${s}\n`)
        if (this._child) this._child.stdin!.write(s + '\n')
    }

    _send(method: string, params?: any): Promise<any> {
        const id = ++this._requestId
        this._sendRaw({ jsonrpc: JSONRPC_VERSION, id, method, params })
        return new Promise((resolve, reject) => {
            this._pending.set(id, { resolve, reject })
        })
    }

    private _notify(method: string, params?: any): void {
        this._sendRaw({ jsonrpc: JSONRPC_VERSION, method, params })
    }

    // ── Public Client API ──────────────────────────────────────

    async initialize(overrides?: any): Promise<any> {
        const r = await this._send('initialize', {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: this._clientCapabilities,
            clientInfo: this._clientInfo,
            ...overrides,
        })
        this._agentCapabilities = r?.agentCapabilities || {}
        this._agentInfo = r?.agentInfo || {}
        return r
    }

    async authenticate(methodId: string): Promise<any> {
        return this._send('authenticate', { methodId })
    }

    async sessionNew(cwd?: string, mcpServers?: any[]): Promise<any> {
        return this._send('session/new', { cwd: cwd || this._cwd, mcpServers: mcpServers || [] })
    }

    async sessionLoad(sessionId: string, cwd?: string, mcpServers?: any[]): Promise<any> {
        return this._send('session/load', { sessionId, cwd: cwd || this._cwd, mcpServers: mcpServers || [] })
    }

    async sessionList(opts?: any): Promise<any> {
        return this._send('session/list', opts || {})
    }

    async sessionPrompt(sessionId: string, prompt: string | any[]): Promise<any> {
        const blocks = typeof prompt === 'string' ? [{ type: 'text', text: prompt }] : prompt
        return this._send('session/prompt', { sessionId, prompt: blocks })
    }

    sessionCancel(sessionId: string): void {
        this._notify('session/cancel', { sessionId })
    }

    async sessionSetMode(sessionId: string, modeId: string): Promise<any> {
        return this._send('session/set_mode', { sessionId, modeId })
    }

    async sessionSetConfigOption(sessionId: string, configId: string, value: any): Promise<any> {
        return this._send('session/set_config_option', { sessionId, configId, value })
    }

    drainNotifications(): Notification[] {
        return this._notifications.splice(0)
    }
    drainHandledRequests(): HandledRequest[] {
        return this._handledRequests.splice(0)
    }
    get agentCapabilities(): any {
        return this._agentCapabilities
    }
    get agentInfo(): any {
        return this._agentInfo
    }
}

// ════════════════════════════════════════════════════════════════
// CLI
// ════════════════════════════════════════════════════════════════

const SUBCOMMANDS = new Set(['initialize', 'prompt'])

interface ParsedArgs {
    agentCmd: string | null
    agentArgs: string[]
    subcommand: string | null
    promptText: string
    cwd: string
    timeout: number
    verbose: boolean
    help: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
    const opts: ParsedArgs = {
        agentCmd: null,
        agentArgs: [],
        subcommand: null,
        promptText: '',
        cwd: process.cwd(),
        timeout: 300_000,
        verbose: false,
        help: false,
    }

    const positionals: string[] = []
    let i = 0
    while (i < argv.length) {
        const a = argv[i]
        if (a === '--cwd' && i + 1 < argv.length) {
            opts.cwd = argv[++i]
        } else if (a === '--timeout' && i + 1 < argv.length) {
            opts.timeout = parseInt(argv[++i], 10)
        } else if (a === '--verbose') {
            opts.verbose = true
        } else if (a === '--help' || a === '-h') {
            opts.help = true
        } else {
            positionals.push(a)
        }
        i++
    }

    // positionals: <agent-cmd> [agent-args...] <subcommand> [subcommand-args...]
    let foundSub = false
    for (let j = 0; j < positionals.length; j++) {
        if (!foundSub && SUBCOMMANDS.has(positionals[j])) {
            opts.subcommand = positionals[j]
            foundSub = true
            if (positionals[j] === 'prompt' && j + 1 < positionals.length) {
                opts.promptText = positionals[j + 1]
                j++
            }
        } else if (!foundSub) {
            if (!opts.agentCmd) {
                opts.agentCmd = positionals[j]
            } else {
                opts.agentArgs.push(positionals[j])
            }
        }
    }

    return opts
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    if (ms <= 0) return promise
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!))
}

const HELP = `ACP Client — talk to any ACP-compatible agent

Usage:
  client.ts <agent> [agent-args...] initialize [options]
  client.ts <agent> [agent-args...] prompt <text> [options]

Subcommands:
  initialize          Initialize agent, print capabilities as JSON
  prompt <text>       Full lifecycle: initialize -> session/new -> prompt
                      Streams agent text to stdout

Options:
  --cwd <path>        Working directory (default: cwd)
  --timeout <ms>      Timeout in ms (default: 300000)
  --verbose           Print raw JSON-RPC to stderr
  --help              Show this help

Examples:
  client.ts codex-acp initialize
  client.ts codex-acp prompt "Fix the type error in src/main.ts"
  client.ts node ./agent.js initialize --verbose
  client.ts codex-acp prompt "Explain this codebase" --cwd ~/project`

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2))

    if (opts.help || !opts.agentCmd || !opts.subcommand) {
        console.log(HELP)
        process.exit(opts.help ? 0 : 1)
    }

    const client = new AcpClient({
        command: opts.agentCmd,
        args: opts.agentArgs,
        cwd: opts.cwd,
        verbose: opts.verbose,
        onUpdate: (_sessionId, update) => {
            if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
                process.stdout.write(update.content.text)
            }
        },
    })

    client.start()

    try {
        switch (opts.subcommand) {
            case 'initialize': {
                const result = await withTimeout(client.initialize(), 30_000, 'initialize')
                console.log(JSON.stringify(result, null, 2))
                break
            }
            case 'prompt': {
                const init = await withTimeout(client.initialize(), 30_000, 'initialize')
                if (opts.verbose) {
                    const name = init.agentInfo?.name || 'unknown'
                    const ver = init.agentInfo?.version || '?'
                    process.stderr.write(`Agent: ${name} v${ver}\n`)
                }

                const session = await withTimeout(client.sessionNew(opts.cwd), 30_000, 'session/new')
                if (opts.verbose) {
                    process.stderr.write(`Session: ${session.sessionId}\n`)
                }

                const result = await withTimeout(
                    client.sessionPrompt(session.sessionId, opts.promptText || 'Say hello'),
                    opts.timeout,
                    'session/prompt',
                )

                process.stdout.write('\n')
                if (opts.verbose) {
                    process.stderr.write(`Stop reason: ${result?.stopReason}\n`)
                }
                break
            }
        }
    } catch (err: any) {
        process.stderr.write(`Error: ${err.message}\n`)
        process.exitCode = 1
    } finally {
        client.close()
    }
}

export { AcpClient }

if (require.main === module) main()
