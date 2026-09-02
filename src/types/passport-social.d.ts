declare module 'passport-kakao' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOption {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  export interface Profile {
    id: number | string;
    provider: string;
    username?: string;
    displayName?: string;
    _json: {
      kakao_account?: {
        email?: string;
        phone_number?: string;
      };
      properties?: {
        nickname?: string;
      };
    };
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOption,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: unknown, user?: Express.User | false) => void
      ) => void
    );
  }
}

declare module 'passport-naver' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOption {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  export interface Profile {
    id: string;
    provider: string;
    displayName?: string;
    emails?: { value: string }[];
    _json: {
      email?: string;
      nickname?: string;
      mobile?: string;
    };
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOption,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: unknown, user?: Express.User | false) => void
      ) => void
    );
  }
}
