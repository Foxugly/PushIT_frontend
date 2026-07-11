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

const IT: PrivacyCopy = {
  badge: 'Legale',
  title: 'Informativa sulla privacy',
  lastUpdated: 'Ultimo aggiornamento: giugno 2026.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      title: 'Titolare del trattamento',
      body: ['Foxugly SRL.', `Contatto: ${CONTACT_EMAIL}.`],
    },
    {
      title: 'Dati che trattiamo',
      items: [
        'Indirizzo e-mail e identificativi dell’account (creazione dell’account, autenticazione).',
        'Token di notifica (Firebase Cloud Messaging) del tuo dispositivo, per instradare le notifiche push.',
        'Contenuto delle notifiche che ricevi (titolo, messaggio, applicazione mittente).',
        'Token di sessione (JWT), memorizzato in forma cifrata sul dispositivo.',
      ],
    },
    {
      title: 'Finalità',
      body: [
        'Fornire il servizio: autenticazione, instradamento e visualizzazione delle tue notifiche push. Non trattiamo i tuoi dati a fini pubblicitari.',
      ],
    },
    {
      title: 'Responsabili del trattamento / condivisione',
      body: [
        'Non vendiamo né condividiamo i tuoi dati con terzi, ad eccezione di Google Firebase Cloud Messaging, utilizzato esclusivamente per instradare le notifiche verso il tuo dispositivo. Nessun tracciamento pubblicitario.',
      ],
    },
    {
      title: 'Sicurezza',
      body: [
        'Comunicazioni cifrate in transito (HTTPS) con il server pushit-api.foxugly.com; token memorizzati in forma cifrata sul dispositivo.',
      ],
    },
    {
      title: 'Conservazione ed eliminazione',
      body: [
        `Puoi richiedere l’eliminazione del tuo account e dei dati associati contattandoci all’indirizzo ${CONTACT_EMAIL}; i dati vengono quindi eliminati.`,
      ],
    },
    {
      title: 'I tuoi diritti (GDPR)',
      body: [
        `Accesso, rettifica, cancellazione, portabilità e opposizione. Per esercitare questi diritti: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Contatto',
      body: [`Foxugly SRL — ${CONTACT_EMAIL}.`],
    },
  ],
};

const ES: PrivacyCopy = {
  badge: 'Legal',
  title: 'Política de privacidad',
  lastUpdated: 'Última actualización: junio de 2026.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      title: 'Responsable del tratamiento',
      body: ['Foxugly SRL.', `Contacto: ${CONTACT_EMAIL}.`],
    },
    {
      title: 'Datos que tratamos',
      items: [
        'Dirección de correo electrónico e identificadores de cuenta (creación de cuenta, autenticación).',
        'Token de notificación (Firebase Cloud Messaging) de tu dispositivo, para enrutar las notificaciones push.',
        'Contenido de las notificaciones que recibes (título, mensaje, aplicación emisora).',
        'Token de sesión (JWT), almacenado de forma cifrada en el dispositivo.',
      ],
    },
    {
      title: 'Finalidades',
      body: [
        'Prestar el servicio: autenticación, enrutamiento y visualización de tus notificaciones push. No tratamos tus datos con fines publicitarios.',
      ],
    },
    {
      title: 'Encargados del tratamiento / uso compartido',
      body: [
        'No vendemos ni compartimos tus datos con terceros, con la excepción de Google Firebase Cloud Messaging, utilizado únicamente para enrutar las notificaciones hacia tu dispositivo. Sin seguimiento publicitario.',
      ],
    },
    {
      title: 'Seguridad',
      body: [
        'Comunicaciones cifradas en tránsito (HTTPS) con el servidor pushit-api.foxugly.com; tokens almacenados de forma cifrada en el dispositivo.',
      ],
    },
    {
      title: 'Conservación y eliminación',
      body: [
        `Puedes solicitar la eliminación de tu cuenta y de los datos asociados contactándonos en ${CONTACT_EMAIL}; los datos se eliminan entonces.`,
      ],
    },
    {
      title: 'Tus derechos (RGPD)',
      body: [
        `Acceso, rectificación, supresión, portabilidad y oposición. Para ejercer estos derechos: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: 'Contacto',
      body: [`Foxugly SRL — ${CONTACT_EMAIL}.`],
    },
  ],
};

const PRIVACY_COPY: Record<LanguageCode, PrivacyCopy> = { fr: FR, nl: NL, en: EN, it: IT, es: ES };

export function getPrivacyCopy(lang: LanguageCode): PrivacyCopy {
  return PRIVACY_COPY[lang] ?? EN;
}
