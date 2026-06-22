import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { DatabaseService } from '../shared/database.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

interface UserRow {
  id: number;
  email: string;
  nickname: string;
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(input: SignupDto) {
    const exists = await this.db.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [input.email]);
    if (exists.rowCount) {
      throw new BadRequestException('Email already registered.');
    }

    const passwordHash = await hash(input.password, 10);

    const created = await this.db.withTransaction(async (client) => {
      const userResult = await client.query<{ id: number; email: string; nickname: string }>(
        `INSERT INTO users (email, nickname, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, nickname`,
        [input.email, input.nickname, passwordHash],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO player_profiles (user_id, job, level, exp, atk, hp)
         VALUES ($1, 'SWORDSMAN', 1, 0, 10, 100)`,
        [user.id],
      );
      await client.query('INSERT INTO currencies (user_id, idle_gold, goal_coin) VALUES ($1, 500, 0)', [user.id]);
      await client.query(
        `INSERT INTO consistency_states (user_id, current_streak_days, best_streak_days, execution_rate_14d, consistency_score, streak_recover_tokens)
         VALUES ($1, 0, 0, 0, 0, 1)`,
        [user.id],
      );
      await client.query('INSERT INTO player_battle_states (user_id, current_stage_id) VALUES ($1, 1)', [user.id]);

      return user;
    });

    const token = await this.signToken(created.id, created.email);

    return {
      user: created,
      accessToken: token,
    };
  }

  async login(input: LoginDto) {
    const result = await this.db.query<UserRow>(
      'SELECT id, email, nickname, password_hash FROM users WHERE email = $1',
      [input.email],
    );
    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const ok = await compare(input.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = await this.signToken(user.id, user.email);

    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      accessToken: token,
    };
  }

  private async signToken(userId: number, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as never,
      },
    );
  }
}
