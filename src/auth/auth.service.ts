import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { JwtPayloadUser } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthResponse,
  AuthUserResponse,
  mapUserToAuthResponse,
} from './mappers/auth-response.mapper';

const BCRYPT_ROUNDS = 12;
const SEED_CRAFTSMAN_EMAIL = 'tho@jewelry.local';
const SEED_CRAFTSMAN_PASSWORD = 'Tho123456!';
const SEED_CRAFTSMAN_FULL_NAME = 'Thợ Kim Hoàn';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: SEED_CRAFTSMAN_EMAIL },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash(
      SEED_CRAFTSMAN_PASSWORD,
      BCRYPT_ROUNDS,
    );
    await this.prisma.user.create({
      data: {
        email: SEED_CRAFTSMAN_EMAIL,
        passwordHash,
        fullName: SEED_CRAFTSMAN_FULL_NAME,
      },
    });
    this.logger.log(`Seeded default craftsman user: ${SEED_CRAFTSMAN_EMAIL}`);
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng.');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
      },
      select: { id: true, email: true, fullName: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });
  }

  async getMe(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại.');
    }
    return mapUserToAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    fullName: string;
  }): AuthResponse {
    const payload: JwtPayloadUser = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: mapUserToAuthResponse(user),
    };
  }
}
