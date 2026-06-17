import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegisterUser } from '../../application/RegisterUser';
import { LoginUser } from '../../application/LoginUser';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { AuthUser } from '../../../../shared/auth/auth-user';

class RegisterRequest {
  @ApiProperty({ example: 'demo-player' })
  username!: string;
  @ApiProperty({ example: 'changeme123', minLength: 8 })
  password!: string;
}
class RegisterResultDto {
  @ApiProperty({ example: 'a1b2c3' })
  id!: string;
  @ApiProperty({ example: 'demo-player' })
  username!: string;
  @ApiProperty({ example: 'PLAYER' })
  role!: string;
}
class LoginRequest {
  @ApiProperty({ example: 'demo-player' })
  username!: string;
  @ApiProperty({ example: 'changeme123' })
  password!: string;
}
class LoginResultDto {
  @ApiProperty({ example: 'a1b2c3' })
  userId!: string;
  @ApiProperty({ example: 'PLAYER' })
  role!: string;
  @ApiProperty({ description: 'Token Bearer à envoyer dans Authorization' })
  token!: string;
  @ApiProperty({ example: 3600 })
  expiresInSec!: number;
}
class MeDto {
  @ApiProperty({ example: 'a1b2c3' })
  userId!: string;
  @ApiProperty({ example: 'PLAYER' })
  role!: string;
}

interface RegisterBody {
  username?: unknown;
  password?: unknown;
}
interface LoginBody {
  username?: unknown;
  password?: unknown;
}

/** Endpoints d'authentification. `register`/`login` sont PUBLICS ; `me` exige un token (guard). */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginUser: LoginUser,
  ) {}

  @Post('register')
  @ApiBody({ type: RegisterRequest })
  @ApiOkResponse({ type: RegisterResultDto })
  @ApiBadRequestResponse({ description: 'Corps invalide (username/password/role)' })
  async register(@Body() body: RegisterBody): Promise<RegisterResultDto> {
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username.trim() || !password) {
      throw new BadRequestException('username et password requis');
    }
    // L'invariant « auto-inscription → PLAYER » est imposé DANS le use-case (défense en profondeur).
    return this.registerUser.execute({ username, password });
  }

  @Post('login')
  @HttpCode(200)
  @ApiBody({ type: LoginRequest })
  @ApiOkResponse({ type: LoginResultDto })
  @ApiUnauthorizedResponse({ description: 'Identifiants invalides' })
  async login(@Body() body: LoginBody): Promise<LoginResultDto> {
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    return this.loginUser.execute({ username, password });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
  me(@CurrentUser() user: AuthUser): MeDto {
    return { userId: user.userId, role: user.role };
  }
}
