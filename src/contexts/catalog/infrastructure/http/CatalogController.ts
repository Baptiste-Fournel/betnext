import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { MARKET_CATALOG, MarketCatalog } from '../../application/ports/MarketCatalog';
import { CreateMarket } from '../../application/CreateMarket';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

class OutcomeDto {
  @ApiProperty({ example: 'lol-finale-a' })
  id!: string;
  @ApiProperty({ example: 'Victoire Team A' })
  label!: string;
}
class MarketDto {
  @ApiProperty({ example: 'mkt-lol-finale' })
  id!: string;
  @ApiProperty({ example: 'BetNext Major — Team A vs Team B' })
  name!: string;
  @ApiProperty({ example: 'LoL' })
  game!: string;
  @ApiProperty({ type: [OutcomeDto] })
  outcomes!: OutcomeDto[];
}
/** Corps de création d'un marché (modèle GÉNÉRIQUE : N libellés d'issues, ≥ 2). */
class CreateMarketRequest {
  @ApiProperty({ example: 'CS Major — NaVi vs Vitality' })
  name!: string;
  @ApiProperty({ example: 'CS2' })
  game!: string;
  @ApiProperty({ type: [String], example: ['Victoire NaVi', 'Victoire Vitality'] })
  outcomes!: string[];
}

interface CreateMarketBody {
  name?: unknown;
  game?: unknown;
  outcomes?: unknown;
}

/**
 * Catalog. CLASSIFICATION (BET-20) : GET /markets est PUBLIC (catalogue non user-spécifique) ;
 * POST /markets est réservé au rôle MANAGER (création par le gestionnaire). La cote courante se lit
 * via GET /odds/:id (public).
 */
@ApiTags('catalog')
@Controller('markets')
export class CatalogController {
  constructor(
    @Inject(MARKET_CATALOG) private readonly catalog: MarketCatalog,
    private readonly createMarket: CreateMarket,
  ) {}

  @Get()
  @ApiOkResponse({ type: [MarketDto], description: 'Marchés ouverts (modèle N-issues) — PUBLIC' })
  list(): Promise<MarketDto[]> {
    return this.catalog.listOpenMarkets();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiBody({ type: CreateMarketRequest })
  @ApiCreatedResponse({ type: MarketDto, description: 'Marché créé (MANAGER)' })
  @ApiBadRequestResponse({ description: 'Corps invalide (name/game/outcomes)' })
  @ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
  @ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
  @ApiUnprocessableEntityResponse({ description: 'Marché invalide (≥ 2 issues requises)' })
  create(@Body() body: CreateMarketBody): Promise<MarketDto> {
    const { name, game, outcomes } = this.validate(body);
    return this.createMarket.execute({ name, game, outcomeLabels: outcomes });
  }

  private validate(body: CreateMarketBody): { name: string; game: string; outcomes: string[] } {
    const name = typeof body.name === 'string' ? body.name : '';
    const game = typeof body.game === 'string' ? body.game : '';
    const outcomes =
      Array.isArray(body.outcomes) && body.outcomes.every((o) => typeof o === 'string')
        ? (body.outcomes as string[])
        : null;
    const errors: string[] = [];
    if (!name.trim()) errors.push('name (string non vide) requis');
    if (!game.trim()) errors.push('game (string non vide) requis');
    if (outcomes === null) errors.push('outcomes (string[]) requis');
    if (errors.length > 0) throw new BadRequestException(errors);
    return { name, game, outcomes: outcomes as string[] };
  }
}
