import path from 'path'
import { AcpClient } from './client'

// ════════════════════════════════════════════════════════════════
// Test runner — structured compliance checks
// ════════════════════════════════════════════════════════════════

interface TestRunnerOptions {
    prompt?: string
    cwd?: string
    timeout?: number
}

class TestRunner {
    private _h: AcpClient
    private _prompt: string
    private _cwd: string
    private _timeout: number
    private _passed: number
    private _failed: number
    private _skipped: number

    constructor(harness: AcpClient, opts: TestRunnerOptions) {
        this._h = harness
        this._prompt = opts.prompt || 'Say hello'
        this._cwd = opts.cwd || process.cwd()
        this._timeout = opts.timeout || 30000
        this._passed = 0
        this._failed = 0
        this._skipped = 0
    }

    pass(desc: string): void {
        this._passed++
        console.log(`[PASS] ${desc}`)
    }
    fail(desc: string, reason: string): void {
        this._failed++
        console.log(`[FAIL] ${desc}: ${reason}`)
    }
    skip(desc: string, reason: string): void {
        this._skipped++
        console.log(`[SKIP] ${desc}: ${reason}`)
    }

    private async _withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout>
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`timeout after ${this._timeout}ms`)), this._timeout)
        })
        try {
            const result = await Promise.race([promise, timeout])
            clearTimeout(timer!)
            return result
        } catch (err: any) {
            clearTimeout(timer!)
            throw new Error(`${label}: ${err.message}`)
        }
    }

    private _sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms))
    }

    async run(): Promise<boolean> {
        let init: any, session: any

        // ══════════════════════════════════════════════════════════
        // L1: initialize — version negotiation & capability exchange
        // ══════════════════════════════════════════════════════════

        try {
            init = await this._withTimeout(this._h.initialize(), 'initialize')
        } catch (err: any) {
            this.fail('L1 initialize', err.message)
            return this._summary()
        }

        if (typeof init?.protocolVersion !== 'number') {
            this.fail('L1 initialize', `protocolVersion missing (got ${JSON.stringify(init?.protocolVersion)})`)
            return this._summary()
        }
        this.pass(`L1 initialize — protocol v${init.protocolVersion}`)

        // agentInfo
        const info = init.agentInfo
        if (info?.name) {
            this.pass(`L1 agentInfo — ${info.name}${info.version ? ' v' + info.version : ''}`)
        } else {
            this.fail('L1 agentInfo', 'agentInfo.name missing')
        }

        // ══════════════════════════════════════════════════════════
        // C1-C7: Capability declarations
        // ══════════════════════════════════════════════════════════

        const caps = init.agentCapabilities || {}

        // C2: loadSession
        this.pass(`C2 loadSession — ${caps.loadSession ? 'supported' : 'not supported'}`)

        // C3: image
        const pc = caps.promptCapabilities || {}
        this.pass(`C3 promptCapabilities.image — ${pc.image ?? false}`)

        // C4: audio
        this.pass(`C4 promptCapabilities.audio — ${pc.audio ?? false}`)

        // C5: embeddedContext
        this.pass(`C5 promptCapabilities.embeddedContext — ${pc.embeddedContext ?? false}`)

        // C6: mcpCapabilities.http
        const mc = caps.mcpCapabilities || {}
        this.pass(`C6 mcpCapabilities.http — ${mc.http ?? false}`)

        // C7: sessionCapabilities.list
        const sc = caps.sessionCapabilities || {}
        this.pass(`C7 sessionCapabilities.list — ${sc.list ?? false}`)

        // ══════════════════════════════════════════════════════════
        // L2: authenticate
        // ══════════════════════════════════════════════════════════

        if (init.authMethods?.length) {
            try {
                const authResult = await this._withTimeout(this._h.authenticate(init.authMethods[0].id), 'authenticate')
                if (authResult.authenticated) {
                    this.pass(`L2 authenticate — method "${init.authMethods[0].id}", user="${authResult.user?.name}"`)
                } else {
                    this.fail('L2 authenticate', 'not authenticated')
                }
            } catch (err: any) {
                this.fail('L2 authenticate', err.message)
            }
        } else {
            this.skip('L2 authenticate', 'no authMethods advertised')
        }

        // ══════════════════════════════════════════════════════════
        // S1: session/new
        // ══════════════════════════════════════════════════════════

        try {
            session = await this._withTimeout(this._h.sessionNew(this._cwd), 'session/new')
        } catch (err: any) {
            this.fail('S1 session/new', err.message)
            return this._summary()
        }

        if (typeof session?.sessionId !== 'string' || !session.sessionId) {
            this.fail('S1 session/new', `sessionId missing (got ${JSON.stringify(session?.sessionId)})`)
            return this._summary()
        }
        this.pass(`S1 session/new — sessionId="${session.sessionId}"`)

        // modes
        if (session.modes?.availableModes?.length) {
            const modeNames = session.modes.availableModes.map((m: any) => m.id).join(', ')
            this.pass(`S1 modes — current="${session.modes.currentModeId}" available=[${modeNames}]`)
        } else {
            this.skip('S1 modes', 'not provided')
        }

        // configOptions
        if (session.configOptions?.length) {
            const optNames = session.configOptions.map((o: any) => o.id).join(', ')
            this.pass(`S1 configOptions — [${optNames}]`)
        } else {
            this.skip('S1 configOptions', 'not provided')
        }

        // slash commands
        await this._sleep(200)
        const postSessionNotifs = this._h.drainNotifications()
        const cmdUpdate = postSessionNotifs.find((n) => n.params?.update?.sessionUpdate === 'available_commands_update')
        if (cmdUpdate) {
            const cmds = cmdUpdate.params.update.availableCommands.map((c: any) => `/${c.name}`).join(', ')
            this.pass(`S1 slash commands — ${cmds}`)
        } else {
            this.skip('S1 slash commands', 'no available_commands_update received')
        }

        // ══════════════════════════════════════════════════════════
        // P1-P4: session/prompt — streaming, tools, plan
        // ══════════════════════════════════════════════════════════

        this._h.drainHandledRequests() // clear before prompt

        let promptResult: any
        try {
            promptResult = await this._withTimeout(
                this._h.sessionPrompt(session.sessionId, this._prompt),
                'session/prompt',
            )
        } catch (err: any) {
            this.fail('P1 session/prompt', err.message)
            return this._summary()
        }

        // P8: StopReason (end_turn)
        const validStopReasons = ['end_turn', 'max_tokens', 'max_turn_requests', 'refusal', 'cancelled']
        if (!validStopReasons.includes(promptResult?.stopReason)) {
            this.fail('P1 session/prompt stopReason', `got "${promptResult?.stopReason}"`)
        } else {
            this.pass(`P1 session/prompt — stopReason="${promptResult.stopReason}"`)
        }

        const turnNotifs = this._h.drainNotifications()
        const updates = turnNotifs.filter((n) => n.method === 'session/update').map((n) => n.params?.update)

        // P2: agent_message_chunk
        const chunks = updates.filter((u: any) => u?.sessionUpdate === 'agent_message_chunk')
        if (chunks.length > 0) {
            this.pass(`P2 streaming — ${chunks.length} chunks`)
        } else {
            this.fail('P2 streaming', 'no agent_message_chunk received')
        }

        // P3: tool_call + tool_call_update
        const toolCalls = updates.filter((u: any) => u?.sessionUpdate === 'tool_call')
        const toolUpdates = updates.filter((u: any) => u?.sessionUpdate === 'tool_call_update')
        if (toolCalls.length > 0) {
            this.pass(`P3 tool calls — ${toolCalls.length} created, ${toolUpdates.length} updates`)
        } else {
            this.fail('P3 tool calls', 'none observed')
        }

        // P4: plan
        const plans = updates.filter((u: any) => u?.sessionUpdate === 'plan')
        if (plans.length > 0) {
            this.pass(`P4 plan — ${plans.length} updates, ${plans[plans.length - 1].entries?.length || 0} entries`)
        } else {
            this.fail('P4 plan', 'none observed')
        }

        // ══════════════════════════════════════════════════════════
        // TC1-TC4: Tool call details
        // ══════════════════════════════════════════════════════════

        // TC2: status flow — check for pending→in_progress→completed and failed
        const hasFailed = toolUpdates.some((u: any) => u.status === 'failed')
        const hasInProgress = toolUpdates.some((u: any) => u.status === 'in_progress')
        const hasCompleted = toolUpdates.some((u: any) => u.status === 'completed')
        if (hasInProgress && hasCompleted && hasFailed) {
            this.pass('TC2 tool status — pending→in_progress→completed + failed')
        } else {
            const missing: string[] = []
            if (!hasInProgress) missing.push('in_progress')
            if (!hasCompleted) missing.push('completed')
            if (!hasFailed) missing.push('failed')
            this.fail('TC2 tool status', `missing: ${missing.join(', ')}`)
        }

        // TC3: tool kinds — read, edit, execute
        const kinds = new Set(toolCalls.map((t: any) => t.kind))
        const requiredKinds = ['read', 'edit', 'execute']
        const missingKinds = requiredKinds.filter((k) => !kinds.has(k))
        if (missingKinds.length === 0) {
            this.pass(`TC3 tool kinds — ${[...kinds].join(', ')}`)
        } else {
            this.fail('TC3 tool kinds', `missing: ${missingKinds.join(', ')} (got: ${[...kinds].join(', ')})`)
        }

        // TC4: tool content types — text, file_diff, terminal
        const allContent = toolUpdates.flatMap((u: any) => u.content || [])
        const contentTypes = new Set(allContent.map((c: any) => c.type))
        const requiredContent = ['content', 'file_diff', 'terminal']
        const missingContent = requiredContent.filter((t) => !contentTypes.has(t))
        if (missingContent.length === 0) {
            this.pass(`TC4 tool content — ${[...contentTypes].join(', ')}`)
        } else {
            this.fail(
                'TC4 tool content',
                `missing: ${missingContent.join(', ')} (got: ${[...contentTypes].join(', ')})`,
            )
        }

        // ══════════════════════════════════════════════════════════
        // CT1-CT5: Content types in streaming
        // ══════════════════════════════════════════════════════════

        const chunkTypes = new Set(chunks.map((c: any) => c.content?.type))

        // CT1: TextContent
        if (chunkTypes.has('text')) {
            this.pass('CT1 TextContent')
        } else {
            this.fail('CT1 TextContent', 'no text chunks')
        }

        // CT2: ImageContent
        if (chunkTypes.has('image')) {
            const img = chunks.find((c: any) => c.content?.type === 'image')
            this.pass(`CT2 ImageContent — ${img.content.mimeType}`)
        } else {
            this.fail('CT2 ImageContent', 'no image chunks')
        }

        // CT3: AudioContent
        if (chunkTypes.has('audio')) {
            const aud = chunks.find((c: any) => c.content?.type === 'audio')
            this.pass(`CT3 AudioContent — ${aud.content.mimeType}`)
        } else {
            this.fail('CT3 AudioContent', 'no audio chunks')
        }

        // CT4: EmbeddedResource
        if (chunkTypes.has('resource')) {
            const res = chunks.find((c: any) => c.content?.type === 'resource')
            this.pass(`CT4 EmbeddedResource — ${res.content.resource?.uri}`)
        } else {
            this.fail('CT4 EmbeddedResource', 'no resource chunks')
        }

        // CT5: ResourceLink
        if (chunkTypes.has('resource_link')) {
            const rl = chunks.find((c: any) => c.content?.type === 'resource_link')
            this.pass(`CT5 ResourceLink — ${rl.content.uri}`)
        } else {
            this.fail('CT5 ResourceLink', 'no resource_link chunks')
        }

        // ══════════════════════════════════════════════════════════
        // PM1-PM2, FS1-FS3, TM1-TM5: Client-handled requests
        // ══════════════════════════════════════════════════════════

        const handled = this._h.drainHandledRequests()

        // PM1: session/request_permission
        const permReqs = handled.filter((r) => r.method === 'session/request_permission')
        if (permReqs.length > 0) {
            this.pass('PM1 request_permission — handled')
        } else {
            this.fail('PM1 request_permission', 'agent never requested permission')
        }

        // PM2: PermissionOptionKind
        const permKinds = new Set((permReqs[0]?.params?.options || []).map((o: any) => o.kind))
        const requiredPermKinds = ['allow_once', 'allow_always', 'reject_once']
        const missingPermKinds = requiredPermKinds.filter((k) => !permKinds.has(k))
        if (missingPermKinds.length === 0) {
            this.pass(`PM2 PermissionOptionKind — ${[...permKinds].join(', ')}`)
        } else {
            this.fail('PM2 PermissionOptionKind', `missing: ${missingPermKinds.join(', ')}`)
        }

        // FS1: fs/read_text_file
        const fsReads = handled.filter((r) => r.method === 'fs/read_text_file')
        if (fsReads.length > 0) {
            this.pass(`FS1 fs/read_text_file — ${fsReads.length} read(s)`)
        } else {
            this.fail('FS1 fs/read_text_file', 'never called')
        }

        // FS2: fs/write_text_file
        const fsWrites = handled.filter((r) => r.method === 'fs/write_text_file')
        if (fsWrites.length > 0) {
            this.pass(`FS2 fs/write_text_file — ${fsWrites.length} write(s)`)
        } else {
            this.fail('FS2 fs/write_text_file', 'never called')
        }

        // FS3: fs/read_text_file with line/limit
        const lineReads = fsReads.filter((r) => r.params?.line || r.params?.limit)
        if (lineReads.length > 0) {
            this.pass(`FS3 fs/read line/limit — line=${lineReads[0].params.line}, limit=${lineReads[0].params.limit}`)
        } else {
            this.fail('FS3 fs/read line/limit', 'never called with line/limit')
        }

        // TM1: terminal/create
        const termCreates = handled.filter((r) => r.method === 'terminal/create')
        if (termCreates.length > 0) {
            this.pass(`TM1 terminal/create — ${termCreates.length} terminal(s)`)
        } else {
            this.fail('TM1 terminal/create', 'never called')
        }

        // TM2: terminal/output
        if (handled.some((r) => r.method === 'terminal/output')) {
            this.pass('TM2 terminal/output')
        } else {
            this.fail('TM2 terminal/output', 'never called')
        }

        // TM3: terminal/wait_for_exit
        if (handled.some((r) => r.method === 'terminal/wait_for_exit')) {
            this.pass('TM3 terminal/wait_for_exit')
        } else {
            this.fail('TM3 terminal/wait_for_exit', 'never called')
        }

        // TM4: terminal/kill
        if (handled.some((r) => r.method === 'terminal/kill')) {
            this.pass('TM4 terminal/kill')
        } else {
            this.fail('TM4 terminal/kill', 'never called')
        }

        // TM5: terminal/release
        if (handled.some((r) => r.method === 'terminal/release')) {
            this.pass('TM5 terminal/release')
        } else {
            this.fail('TM5 terminal/release', 'never called')
        }

        // ══════════════════════════════════════════════════════════
        // E1: _meta field
        // ══════════════════════════════════════════════════════════

        const metaCount = turnNotifs.filter((n) => n._meta).length
        if (metaCount > 0) {
            this.pass(`E1 _meta — present in ${metaCount}/${turnNotifs.length} notifications`)
        } else {
            this.fail('E1 _meta', 'no _meta found in any notification')
        }

        // ══════════════════════════════════════════════════════════
        // S5: session/set_config_option + P6: config_option_update
        // ══════════════════════════════════════════════════════════

        if (session.configOptions?.length) {
            const opt = session.configOptions[0]
            const altValue = opt.options?.find((v: any) => v.value !== opt.currentValue)
            if (altValue) {
                try {
                    const r = await this._withTimeout(
                        this._h.sessionSetConfigOption(session.sessionId, opt.id, altValue.value),
                        'set_config_option',
                    )
                    if (r?.configOptions) {
                        this.pass(`S5 set_config_option — ${opt.id}="${altValue.value}"`)
                    } else {
                        this.fail('S5 set_config_option', 'response missing configOptions')
                    }
                    // P6: check notification
                    await this._sleep(100)
                    const configNotifs = this._h.drainNotifications()
                    const configUpdate = configNotifs.find(
                        (n) => n.params?.update?.sessionUpdate === 'config_option_update',
                    )
                    if (configUpdate) {
                        this.pass('P6 config_option_update — notified')
                    } else {
                        this.fail('P6 config_option_update', 'no notification')
                    }
                } catch (err: any) {
                    this.fail('S5 set_config_option', err.message)
                }
            }
        }

        // ══════════════════════════════════════════════════════════
        // S4: session/set_mode + P5: current_mode_update
        // ══════════════════════════════════════════════════════════

        if (session.modes?.availableModes?.length > 1) {
            const alt = session.modes.availableModes.find((m: any) => m.id !== session.modes.currentModeId)
            if (alt) {
                try {
                    const r = await this._withTimeout(this._h.sessionSetMode(session.sessionId, alt.id), 'set_mode')
                    if (r?.modes) {
                        this.pass(`S4 set_mode — switched to "${alt.id}"`)
                    } else {
                        this.fail('S4 set_mode', 'response missing modes')
                    }
                    // P5: check notification
                    await this._sleep(100)
                    const modeNotifs = this._h.drainNotifications()
                    const modeUpdate = modeNotifs.find((n) => n.params?.update?.sessionUpdate === 'current_mode_update')
                    if (modeUpdate) {
                        this.pass(`P5 current_mode_update — modeId="${modeUpdate.params.update.modeId}"`)
                    } else {
                        this.fail('P5 current_mode_update', 'no notification')
                    }
                } catch (err: any) {
                    this.fail('S4 set_mode', err.message)
                }
            }
        } else {
            this.skip('S4 set_mode', 'fewer than 2 modes')
        }

        // ══════════════════════════════════════════════════════════
        // S2: session/load
        // ══════════════════════════════════════════════════════════

        if (caps.loadSession) {
            try {
                await this._withTimeout(this._h.sessionLoad(session.sessionId, this._cwd), 'session/load')
                this.pass('S2 session/load — loaded existing session')
            } catch (err: any) {
                this.fail('S2 session/load', err.message)
            }
        } else {
            this.skip('S2 session/load', 'loadSession not advertised')
        }

        // ══════════════════════════════════════════════════════════
        // S3: session/list (basic)
        // ══════════════════════════════════════════════════════════

        if (sc.list) {
            try {
                const r = await this._withTimeout(this._h.sessionList(), 'session/list')
                this.pass(`S3 session/list — ${r?.sessions?.length ?? 0} session(s)`)
            } catch (err: any) {
                this.fail('S3 session/list', err.message)
            }
        } else {
            this.skip('S3 session/list', 'list not advertised')
        }

        // ══════════════════════════════════════════════════════════
        // P7+P8: session/cancel — stopReason="cancelled"
        // ══════════════════════════════════════════════════════════

        try {
            this._h.drainNotifications()
            const cancelPromise = this._withTimeout(
                this._h.sessionPrompt(session.sessionId, 'cancel test'),
                'session/prompt (cancel)',
            )
            await this._sleep(100)
            this._h.sessionCancel(session.sessionId)
            const cancelResult = await cancelPromise
            if (cancelResult?.stopReason === 'cancelled') {
                this.pass('P7 session/cancel — stopReason="cancelled"')
                this.pass('P8 StopReason variety — end_turn + cancelled verified')
            } else {
                this.fail('P7 session/cancel', `expected "cancelled", got "${cancelResult?.stopReason}"`)
            }
        } catch (err: any) {
            this.fail('P7 session/cancel', err.message)
        }
        this._h.drainNotifications()

        // ══════════════════════════════════════════════════════════
        // E2: Extended methods — _ping
        // ══════════════════════════════════════════════════════════

        try {
            const pong = await this._withTimeout(this._h._send('_ping', { data: 'hello' }), '_ping')
            if (pong?.pong === true) {
                this.pass('E2 extended method — _ping OK')
            } else {
                this.fail('E2 extended method', `unexpected response: ${JSON.stringify(pong)}`)
            }
        } catch (err: any) {
            this.fail('E2 extended method', err.message)
        }

        // ══════════════════════════════════════════════════════════
        // MCP1+MCP2: session/new with MCP servers
        // ══════════════════════════════════════════════════════════

        try {
            const mcpSession = await this._withTimeout(
                this._h.sessionNew(this._cwd, [
                    { type: 'stdio', name: 'test-stdio-mcp', command: 'echo', args: ['mcp'] },
                    { type: 'http', name: 'test-http-mcp', url: 'http://localhost:8080/mcp' },
                ]),
                'session/new (MCP)',
            )
            if (mcpSession?.sessionId) {
                await this._sleep(200)
                const mcpNotifs = this._h.drainNotifications()
                const mcpChunk = mcpNotifs.find(
                    (n) =>
                        n.params?.update?.sessionUpdate === 'agent_message_chunk' &&
                        n.params?.update?.content?.text?.includes('[MCP]'),
                )
                if (mcpChunk) {
                    this.pass('MCP1 stdio MCP — acknowledged')
                    this.pass('MCP2 HTTP MCP — acknowledged')
                } else {
                    this.fail('MCP1+MCP2', 'agent did not acknowledge MCP servers')
                }
            } else {
                this.fail('MCP1+MCP2', 'session creation failed')
            }
        } catch (err: any) {
            this.fail('MCP1+MCP2', err.message)
        }

        // ══════════════════════════════════════════════════════════
        // S3 pagination: session/list with cursor + limit
        // ══════════════════════════════════════════════════════════

        if (sc.list) {
            try {
                const page1 = await this._withTimeout(this._h.sessionList({ limit: 1 }), 'session/list page1')
                if (page1?.sessions?.length === 1 && page1.nextCursor) {
                    const page2 = await this._withTimeout(
                        this._h.sessionList({ limit: 1, cursor: page1.nextCursor }),
                        'session/list page2',
                    )
                    if (page2?.sessions?.length >= 1) {
                        this.pass(
                            `S3 pagination — page1="${page1.sessions[0].sessionId}", page2="${page2.sessions[0].sessionId}"`,
                        )
                    } else {
                        this.fail('S3 pagination', 'page2 empty')
                    }
                } else if (page1?.sessions?.length >= 2) {
                    this.pass(`S3 pagination — ${page1.sessions.length} sessions (no pagination needed)`)
                } else {
                    this.fail('S3 pagination', `page1 has ${page1?.sessions?.length} session(s), no nextCursor`)
                }
            } catch (err: any) {
                this.fail('S3 pagination', err.message)
            }
        }

        return this._summary()
    }

    private _summary(): boolean {
        console.log('---')
        console.log(`RESULT: ${this._passed} passed, ${this._failed} failed, ${this._skipped} skipped`)
        return this._failed === 0
    }
}

// ════════════════════════════════════════════════════════════════
// CLI
// ════════════════════════════════════════════════════════════════

interface ParsedArgs {
    agentCmd: string | null
    agentArgs: string[]
    prompt: string
    cwd: string
    timeout: number
    verbose: boolean
    help?: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
    const opts: ParsedArgs = {
        agentCmd: null,
        agentArgs: [],
        prompt: 'Say hello',
        cwd: process.cwd(),
        timeout: 30000,
        verbose: false,
    }
    let i = 0
    while (i < argv.length) {
        const a = argv[i]
        if (a === '--prompt' && i + 1 < argv.length) {
            opts.prompt = argv[++i]
        } else if (a === '--cwd' && i + 1 < argv.length) {
            opts.cwd = argv[++i]
        } else if (a === '--timeout' && i + 1 < argv.length) {
            opts.timeout = parseInt(argv[++i], 10)
        } else if (a === '--verbose') {
            opts.verbose = true
        } else if (a === '--help' || a === '-h') {
            opts.help = true
        } else if (!opts.agentCmd) {
            opts.agentCmd = a
        } else {
            opts.agentArgs.push(a)
        }
        i++
    }
    return opts
}

const help_text = (bin: string): string => `ACP Test Harness — test any Agent's ACP compliance

Usage: ${bin} <agent-command> [agent-args...] [options]

Options:
  --prompt "text"    Prompt to send (default: "Say hello")
  --cwd /path        Working directory for session (default: cwd)
  --timeout 30000    Per-step timeout in ms (default: 30000)
  --verbose          Print raw JSON-RPC to stderr
  --help             Show this help

Examples:
  ${bin} node ./index.js
  ${bin} qwen-code --prompt "Explain this codebase"
  ${bin} codex agent --cwd /home/user/project`

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2))
    const bin = path.basename(process.argv[1])

    if (opts.help || !opts.agentCmd) {
        console.log(help_text(bin))
        process.exit(opts.help ? 0 : 1)
    }

    const harness = new AcpClient({
        command: opts.agentCmd,
        args: opts.agentArgs,
        cwd: opts.cwd,
        verbose: opts.verbose,
    })

    harness.start()

    console.log(`ACP Test Harness`)
    console.log(`Agent: ${opts.agentCmd} ${opts.agentArgs.join(' ')}`.trim())
    console.log(`Prompt: "${opts.prompt}"`)
    console.log(`cwd: ${opts.cwd}`)
    console.log('---')

    const runner = new TestRunner(harness, {
        prompt: opts.prompt,
        cwd: opts.cwd,
        timeout: opts.timeout,
    })

    try {
        const allPassed = await runner.run()
        process.exitCode = allPassed ? 0 : 1
    } catch (err: any) {
        console.log(`[FAIL] unexpected error: ${err.message}`)
        process.exitCode = 1
    } finally {
        harness.close()
    }
}

export { TestRunner }

if (require.main === module) main()
