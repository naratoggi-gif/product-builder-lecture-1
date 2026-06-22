import { Body, Controller, Post } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionRequestDto } from './dto/prediction-request.dto';
import { CurrentUserId } from '../shared/current-user-id.decorator';

@Controller('prediction')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('score')
  score(@CurrentUserId() userId: number, @Body() body: PredictionRequestDto) {
    return this.predictionService.score(userId, body);
  }
}
