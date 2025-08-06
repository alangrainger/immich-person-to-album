export interface Config {
  immichServer: string;
  schedule: string;
  users: User[]
}

export interface User {
  apiKey: string;
  personLinks: Link[]
}

export interface Link {
  description?: string;
  personId: string;
  albumId: string;
  apiKeyShort: string;
}
