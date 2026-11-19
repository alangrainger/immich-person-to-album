export interface Config {
  immichServer: string;
  schedule: string;
  users: User[]
}

export interface User {
  apiKey: string;
  personLinks: LinkConfig[]
}

export type Logic = 'AND' | 'OR'

/**
 * A person-album link as written in the config file
 */
export interface LinkConfig {
  description?: string;
  albumId: string;
  personIds?: string[];
  /** Old single-person field. `normaliseLink` changes it to `personIds`. */
  personId?: string;
  logic?: Logic;
  excludePersonIds?: string[];
  noOtherPeople?: boolean;
}

/**
 * A person-album link with the defaults applied and the fields checked
 */
export interface Link {
  description?: string;
  albumId: string;
  personIds: string[];
  logic: Logic;
  excludePersonIds: string[];
  noOtherPeople: boolean;
}
