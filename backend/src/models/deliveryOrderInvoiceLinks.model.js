// const { DataTypes } = require("sequelize");

// module.exports = (sequelize) => {
//   const DeliveryOrderInvoiceLinks = sequelize.define(
//     "DeliveryOrderInvoiceLinks",
//     {
//       id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true,
//         allowNull: false,
//       },
//       invoice_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },
//       delivery_order_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },
//     },
//     {
//       tableName: "delivery_order_invoice_links",
//       timestamps: true,
//       underscored: true,
//     }
//   );

//   DeliveryOrderInvoiceLinks.associate = (models) => {
//     DeliveryOrderInvoiceLinks.belongsTo(models.DeliveryOrderInvoices, {
//       foreignKey: "invoice_id",
//       as: "invoice",
//     });
//     DeliveryOrderInvoiceLinks.belongsTo(models.DeliveryOrder, {
//       foreignKey: "delivery_order_id",
//       as: "deliveryOrder",
//     });
//   };

//   return DeliveryOrderInvoiceLinks;
// };
