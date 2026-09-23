// fonte única dos provedores/modelos de IA — antes duplicada e divergente entre
// settings/page.tsx e admin/users/[id]/page.tsx

export interface LlmModelOption {
  value: string
  label: string
}

export interface LlmProvider {
  key: string
  label: string
  // null = provedor usa a base_url padrão do sdk · '' = usuário define uma url própria
  base_url: string | null
  models: LlmModelOption[]
}

// provedores em nuvem (engine_mode = 'llm')
export const LLM_PROVIDERS: LlmProvider[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    base_url: null,
    models: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'o1-preview', label: 'o1 Preview (Reasoning)' },
      { value: 'o1-mini', label: 'o1 Mini (Reasoning)' },
    ],
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
    ],
  },
  {
    key: 'claude',
    label: 'Claude',
    base_url: null,
    models: [
      { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
    ],
  },
  {
    key: 'grok',
    label: 'Grok',
    base_url: 'https://api.x.ai/v1',
    models: [
      { value: 'grok-2-vision-1212', label: 'Grok 2 Vision' },
      { value: 'grok-2-1212', label: 'Grok 2' },
      { value: 'grok-vision-beta', label: 'Grok Vision Beta' },
    ],
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    base_url: 'https://api.deepseek.com',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    ],
  },
  {
    key: 'custom',
    label: 'Custom (OpenAI-compatível)',
    base_url: '',
    models: [],
  },
]

// motores servidos por um endpoint local próprio, compatível com a api da openai
export const LOCAL_PROVIDERS: LlmProvider[] = [
  {
    key: 'ollama',
    label: 'Ollama (padrão)',
    base_url: 'http://localhost:11434/v1',
    models: [
      { value: 'llama3.2-vision:11b', label: 'LLaMA 3.2 Vision 11B' },
      { value: 'llava:13b', label: 'LLaVA 13B' },
      { value: 'phi3:mini', label: 'Phi-3 Mini' },
    ],
  },
  {
    key: 'lm-studio',
    label: 'LM Studio',
    base_url: 'http://localhost:1234/v1',
    models: [],
  },
  {
    key: 'custom-local',
    label: 'Custom',
    base_url: '',
    models: [],
  },
]
