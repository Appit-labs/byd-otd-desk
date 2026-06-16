export const NOTIFICATION_EVENTS = {
  REQUEST_CREATED:           'notification.request.created',
  VEHICLE_DISPATCHED:        'notification.vehicle.dispatched',
  VEHICLE_RECEIVED:          'notification.vehicle.received',
  MECHANICAL_CHECK_COMPLETE: 'notification.mechanical.complete',
  PDI_COMPLETE:              'notification.pdi.complete',
  SENT_TO_ACCESSORIES:       'notification.accessories.sent',
  ACCESSORIES_COMPLETE:      'notification.accessories.complete',
  FINAL_INSPECTION_DONE:     'notification.finalinspection.done',
  FINAL_INSPECTION_ARCHIVED: 'notification.finalinspection.archived',
  GPS_CONFIRMED:             'notification.gps.confirmed',
  REGISTRATION_DONE:         'notification.registration.done',
  REQUEST_CANCELLED:         'notification.request.cancelled',
  REQUEST_ARCHIVED_MANUAL:   'notification.request.archived.manual',
} as const;

export interface NotificationPayload {
  requestId: number;
  request: {
    chassisNumber: string;
    brand: string;
    model: string;
    variant?: string;
    customerName: string;
    requestType: string;
    promiseDate?: string;
    currentStage: string;
    hasGps?: boolean;
    hasAccessories?: boolean;
  };
  actorName?: string;
}

/**
 * Old event string → new NOTIFICATION_EVENTS constant mapping.
 * Used by notifyRole / notifyRoles backward compatibility shim.
 */
export const LEGACY_EVENT_MAP: Record<string, string> = {
  create:                NOTIFICATION_EVENTS.REQUEST_CREATED,
  dispatchVehicle:       NOTIFICATION_EVENTS.VEHICLE_DISPATCHED,
  vehicleReceived:       NOTIFICATION_EVENTS.VEHICLE_RECEIVED,
  mechanicalCheckComplete: NOTIFICATION_EVENTS.MECHANICAL_CHECK_COMPLETE,
  pdiComplete:           NOTIFICATION_EVENTS.PDI_COMPLETE,
  confirmSentToAccessories: NOTIFICATION_EVENTS.SENT_TO_ACCESSORIES,
  accessoriesComplete:   NOTIFICATION_EVENTS.ACCESSORIES_COMPLETE,
  finalInspection_done:   NOTIFICATION_EVENTS.FINAL_INSPECTION_DONE,
  finalInspection_archive: NOTIFICATION_EVENTS.FINAL_INSPECTION_ARCHIVED,
  confirmGpsDone:        NOTIFICATION_EVENTS.GPS_CONFIRMED,
  register:              NOTIFICATION_EVENTS.REGISTRATION_DONE,
  cancel:                NOTIFICATION_EVENTS.REQUEST_CANCELLED,
  archive:               NOTIFICATION_EVENTS.REQUEST_ARCHIVED_MANUAL,
};
