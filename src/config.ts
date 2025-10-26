import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as jsonfile from 'jsonfile';

export interface VafConfig {
  apiUrl: string;
  token?: string;
  environment?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.vaf');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'http://localhost:3000/api';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: VafConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): VafConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return jsonfile.readFileSync(CONFIG_FILE);
      }
    } catch (error) {
      // Ignore errors, return defaults
    }

    return {
      apiUrl: DEFAULT_API_URL,
    };
  }

  private saveConfig(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      jsonfile.writeFileSync(CONFIG_FILE, this.config, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  public getConfig(): VafConfig {
    return { ...this.config };
  }

  public getApiUrl(): string {
    return this.config.apiUrl;
  }

  public getToken(): string | undefined {
    return this.config.token;
  }

  public setApiUrl(url: string): void {
    this.config.apiUrl = url;
    this.saveConfig();
  }

  public setToken(token: string): void {
    this.config.token = token;
    this.saveConfig();
  }

  public clearToken(): void {
    delete this.config.token;
    this.saveConfig();
  }

  public setEnvironment(env: string): void {
    this.config.environment = env;
    this.saveConfig();
  }

  public getEnvironment(): string | undefined {
    return this.config.environment;
  }

  public clearEnvironment(): void {
    delete this.config.environment;
    this.saveConfig();
  }
}

