import { LanguageCode } from '../../../core/services/public-i18n.service';

export interface PrivacySection {
  title: string;
  // Optional intro paragraph rendered before the list (or alone when no items).
  body?: string[];
  items?: string[];
}

export interface PrivacyCopy {
  badge: string;
  title: string;
  lastUpdated: string;
  contactEmail: string;
  sections: PrivacySection[];
}

// Contact address surfaced on the page (Play Store privacy policy contact).
const CONTACT_EMAIL = 'rvilain@foxugly.com';

const FR: PrivacyCopy = {
  badge: 'Légal',
  title: 'Politique de confidentialité',
  lastUpdated: 'Dernière mise à jour : juin 2026.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      title: 'Responsable du traitement',
      body: ['Foxugly SRL.', `Contact : ${CONTACT_EMAIL}.`],
    },
    {
      title: 'Données que nous traitons',
      items: [
        'Adresse e-mail et identifiants de compte (création de compte, authentification).',
        "Jeton de notification (Firebase Cloud Messaging) de votre appareil, pour acheminer les notifications push.",
        "Contenu des notifications que vous recevez (titre, message, application émettrice).",
        'Jeton de session (JWT), stocké de façon chiffrée sur l’appareil.',
      ],
    },
    {
      title: 'Finalités',
      body: [
        'Fournir le service : authentification, acheminement et affichage de vos notifications push. Nous ne traitons pas vos données à des fins publicitaires.',
      ],
    },
    {
      title: 'Sous-traitants / partage',
      body: [
        'Nous ne vendons ni ne partageons vos données avec des tiers, à l’exception de Google Firebase Cloud Messaging, utilisé uniquement pour acheminer les notifications vers votre appareil. Aucun pistage publicitaire.',
      ],
    },
    {
      title: 'Sécurité',
      body: [
        'Communications chiffrées en transit (HTTPS) avec le serveur pushit-api.foxugly.com ; jetons stockés de façon chiffrée sur l’appareil.',
      ],
    },
    {
      title: 'Conservation et suppression',
      body: [
        `Vous pouvez demander la suppression de votre compte et des données associées en nous contactant à ${CONTACT_EMAIL} ; les données sont alors supprimées.`,
      ],
    },
    {
      title: 'Vos droits (RGPD)',
      body: [
        `Accès, rectification, suppression, portabilité et opposition. Pour exercer ces droits : ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Contact',
      body: [`Foxugly SRL — ${CONTACT_EMAIL}.`],
    },
  ],
};

const NL: PrivacyCopy = {
  badge: 'Juridisch',
  title: 'Privacybeleid',
  lastUpdated: 'Laatst bijgewerkt: juni 2026.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      title: 'Verwerkingsverantwoordelijke',
      body: ['Foxugly SRL.', `Contact: ${CONTACT_EMAIL}.`],
    },
    {
      title: 'Gegevens die wij verwerken',
      items: [
        'E-mailadres en accountgegevens (accountaanmaak, authenticatie).',
        'Notificatietoken (Firebase Cloud Messaging) van uw toestel, om pushnotificaties af te leveren.',
        'Inhoud van de notificaties die u ontvangt (titel, bericht, verzendende applicatie).',
        'Sessietoken (JWT), versleuteld opgeslagen op het toestel.',
      ],
    },
    {
      title: 'Doeleinden',
      body: [
        'De dienst leveren: authenticatie, aflevering en weergave van uw pushnotificaties. Wij verwerken uw gegevens niet voor advertentiedoeleinden.',
      ],
    },
    {
      title: 'Verwerkers / delen',
      body: [
        'Wij verkopen of delen uw gegevens niet met derden, met uitzondering van Google Firebase Cloud Messaging, dat enkel wordt gebruikt om notificaties naar uw toestel af te leveren. Geen advertentietracking.',
      ],
    },
    {
      title: 'Beveiliging',
      body: [
        'Communicatie versleuteld tijdens transport (HTTPS) met de server pushit-api.foxugly.com; tokens versleuteld opgeslagen op het toestel.',
      ],
    },
    {
      title: 'Bewaring en verwijdering',
      body: [
        `U kunt de verwijdering van uw account en bijbehorende gegevens aanvragen door contact met ons op te nemen via ${CONTACT_EMAIL}; de gegevens worden dan verwijderd.`,
      ],
    },
    {
      title: 'Uw rechten (AVG)',
      body: [
        `Inzage, rectificatie, verwijdering, overdraagbaarheid en bezwaar. Om deze rechten uit te oefenen: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Contact',
      body: [`Foxugly SRL — ${CONTACT_EMAIL}.`],
    },
  ],
};

const EN: PrivacyCopy = {
  badge: 'Legal',
  title: 'Privacy policy',
  lastUpdated: 'Last updated: June 2026.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      title: 'Data controller',
      body: ['Foxugly SRL.', `Contact: ${CONTACT_EMAIL}.`],
    },
    {
      title: 'Data we process',
      items: [
        'Email address and account identifiers (account creation, authentication).',
        'Notification token (Firebase Cloud Messaging) from your device, to route push notifications.',
        'Content of the notifications you receive (title, message, sending application).',
        'Session token (JWT), stored encrypted on the device.',
      ],
    },
    {
      title: 'Purposes',
      body: [
        'Providing the service: authentication, routing and display of your push notifications. We do not process your data for advertising purposes.',
      ],
    },
    {
      title: 'Processors / sharing',
      body: [
        'We do not sell or share your data with third parties, with the exception of Google Firebase Cloud Messaging, used solely to route notifications to your device. No advertising tracking.',
      ],
    },
    {
      title: 'Security',
      body: [
        'Communications encrypted in transit (HTTPS) with the pushit-api.foxugly.com server; tokens stored encrypted on the device.',
      ],
    },
    {
      title: 'Retention and deletion',
      body: [
        `You can request the deletion of your account and associated data by contacting us at ${CONTACT_EMAIL}; the data is then deleted.`,
      ],
    },
    {
      title: 'Your rights (GDPR)',
      body: [
        `Access, rectification, deletion, portability and objection. To exercise these rights: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Contact',
      body: [`Foxugly SRL — ${CONTACT_EMAIL}.`],
    },
  ],
};

const PRIVACY_COPY: Record<LanguageCode, PrivacyCopy> = { fr: FR, nl: NL, en: EN };

export function getPrivacyCopy(lang: LanguageCode): PrivacyCopy {
  return PRIVACY_COPY[lang] ?? EN;
}
