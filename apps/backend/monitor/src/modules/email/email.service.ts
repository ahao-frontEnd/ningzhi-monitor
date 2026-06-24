// MailerService 用于发送邮件的类
import { MailerService } from '@nest-modules/mailer'
import { Injectable } from '@nestjs/common'

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  sendEmail(to: string, subject: string, template: string, context: any) {
    this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
    })
  }
}
